import json
import re
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import pymupdf
from backend.ai.skills import extract_skills
from backend.ai.embed import get_embedding, compute_cosine_similarity, compute_ats_score
from backend.ai.prompts import (
    get_suggestions_prompt,
    get_mcq_prompt,
    get_interview_question_prompt,
    get_interview_eval_prompt,
)
from backend.ai.llm import call_llm
from backend.ai.readiness import calculate_readiness_score, get_weakest_topics
from backend.db import (
    save_last_ats_score,
    get_last_ats_score,
    save_quiz_attempt,
    get_topic_accuracies,
    get_all_quiz_attempts,
    save_interview_score,
    get_mean_interview_score,
    get_all_interview_scores,
    reset_db,
    STANDARD_TOPICS,
)

app = FastAPI(title="AI Placement-Prep Portal Demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_json_safely(raw: str) -> Any:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return json.loads(text.strip())

class AnalyzeRequest(BaseModel):
    resume: str
    jd: str

class QuizGenerateRequest(BaseModel):
    topic: str = "DBMS"
    count: int = 5

class QuizAnswerItem(BaseModel):
    selected_index: int
    correct_index: int
    question: Optional[str] = None

class QuizSubmitRequest(BaseModel):
    topic: str
    answers: List[QuizAnswerItem]

class InterviewNextRequest(BaseModel):
    role: str = "Software Engineer (Backend)"
    history: Optional[str] = ""

class InterviewEvaluateRequest(BaseModel):
    role: str = "Software Engineer (Backend)"
    question: str
    answer: str

@app.get("/api/health")
def health_check():
    return {"ok": True}

@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    """
    Extracts plain text from an uploaded PDF resume using PyMuPDF (D7).
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    try:
        content = await file.read()
        doc = pymupdf.open(stream=content, filetype="pdf")
        text = "\n".join([page.get_text() for page in doc]).strip()
        doc.close()
        return {"text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse PDF: {str(e)}")

@app.post("/api/analyze")
def analyze_resume_vs_jd(payload: AnalyzeRequest):
    """
    Panel 1 ATS Analysis:
    1. Extract skills from Resume and JD (D8).
    2. Compute dense embeddings and cosine similarity with all-MiniLM-L6-v2 (D6).
    3. Calculate ATS score based on locked formula D9.
    4. Call Groq LLM (openai/gpt-oss-120b) for exactly 5 suggestions (D4, D4a, D5).
    5. Save ATS score in SQLite for dashboard readiness (D3, D10).
    """
    resume_text = payload.resume.strip()
    jd_text = payload.jd.strip()

    if not resume_text or not jd_text:
        raise HTTPException(status_code=400, detail="Both resume and job description text are required.")

    # 1. Skill Extraction
    resume_skills = extract_skills(resume_text)
    jd_skills = extract_skills(jd_text)

    set_resume = set(resume_skills)
    set_jd = set(jd_skills)

    matched_skills = sorted(list(set_resume & set_jd))
    missing_skills = sorted(list(set_jd - set_resume))

    # 2. Embeddings & Cosine Similarity
    r_emb = get_embedding(resume_text)
    jd_emb = get_embedding(jd_text)
    cosine_sim = compute_cosine_similarity(r_emb, jd_emb)

    # 3. ATS Score (Locked formula D9)
    ats_score = compute_ats_score(cosine_sim, len(matched_skills), len(jd_skills))

    # 4. Suggestions via Groq LLM
    suggestions = []
    try:
        prompt = get_suggestions_prompt(resume_text, jd_text, missing_skills)
        llm_output = call_llm(prompt, max_tokens=600)
        parsed = parse_json_safely(llm_output)
        if isinstance(parsed, dict) and "suggestions" in parsed:
            suggestions = parsed["suggestions"]
        elif isinstance(parsed, list):
            suggestions = parsed
    except Exception as e:
        err_str = str(e)
        if "rate limit" in err_str.lower() or "429" in err_str:
            suggestions = ["Rate limited by Groq API. Please retry in a few seconds."]
        else:
            suggestions = [
                f"Highlight missing requirements directly: {', '.join(missing_skills[:3]) if missing_skills else 'align project metrics with JD keywords'}.",
                "Quantify project accomplishments using the Action + Context + Result formula.",
                "Ensure core computer science concepts and tools from the JD are explicitly listed in your skills section.",
                "Tailor your summary to mirror the key responsibilities of the target job description.",
                "Review technical keywords and ensure consistent casing and terminology."
            ]

    if not isinstance(suggestions, list) or len(suggestions) == 0:
        suggestions = ["Review job description requirements and include corresponding project work."]

    # 5. Persist ATS score in SQLite
    save_last_ats_score(ats_score)

    return {
        "ats_score": ats_score,
        "cosine_similarity": round(cosine_sim, 3),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "all_resume_skills": resume_skills,
        "all_jd_skills": jd_skills,
        "suggestions": suggestions[:5]
    }

@app.post("/api/quiz/generate")
def generate_quiz(payload: QuizGenerateRequest):
    """
    Panel 2 Practice Test: Generate MCQs on topic (DBMS, OS, DSA, CN, OOP, Aptitude).
    Prompts Groq LLM for JSON containing 5 multiple-choice questions (§6).
    """
    topic = payload.topic.strip() or "DBMS"
    count = min(max(payload.count, 1), 5) # Default 5, capped at 5 for token efficiency (D4a)

    prompt = get_mcq_prompt(topic, count)
    try:
        raw_output = call_llm(prompt, max_tokens=1000)
        parsed = parse_json_safely(raw_output)
        raw_questions = parsed.get("questions", []) if isinstance(parsed, dict) else parsed

        if not isinstance(raw_questions, list) or len(raw_questions) == 0:
            raise ValueError("No questions array found in LLM response")

        questions = []
        for q in raw_questions[:count]:
            options = q.get("options", [])
            if not isinstance(options, list) or len(options) < 2:
                options = ["Option A", "Option B", "Option C", "Option D"]
            questions.append({
                "question": str(q.get("question", "")),
                "options": [str(opt) for opt in options],
                "correct_index": int(q.get("correct_index", 0)),
                "explanation": str(q.get("explanation", ""))
            })

        return {
            "topic": topic,
            "count": len(questions),
            "questions": questions
        }
    except Exception as e:
        err_msg = str(e)
        if "rate limit" in err_msg.lower() or "429" in err_msg:
            raise HTTPException(status_code=429, detail="Rate limited by Groq API. Please retry in a few seconds.")
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {err_msg}")

@app.post("/api/quiz/submit")
def submit_quiz(payload: QuizSubmitRequest):
    """
    Panel 2 Quiz Submission:
    Computes score, persists per-topic accuracy to SQLite (D3), and returns explanations and updated topic stats.
    """
    topic = payload.topic.strip() or "DBMS"
    total_count = len(payload.answers)
    if total_count == 0:
        raise HTTPException(status_code=400, detail="Cannot submit an empty quiz.")

    correct_count = sum(1 for a in payload.answers if a.selected_index == a.correct_index)
    accuracy = round((correct_count / total_count) * 100.0, 1)

    attempt_id = save_quiz_attempt(topic, correct_count, total_count, accuracy)
    topic_accuracies = get_topic_accuracies()

    return {
        "attempt_id": attempt_id,
        "topic": topic,
        "correct_count": correct_count,
        "total_count": total_count,
        "accuracy": accuracy,
        "topic_accuracies": topic_accuracies
    }

@app.get("/api/quiz/progress")
def get_quiz_progress():
    """
    Returns aggregated topic accuracies and recent attempt history for dashboard integration.
    """
    return {
        "topic_accuracies": get_topic_accuracies(),
        "recent_attempts": get_all_quiz_attempts()
    }

# ==================== STEP 5: MOCK INTERVIEW ENDPOINTS ====================

@app.post("/api/interview/next")
def get_next_interview_question(payload: InterviewNextRequest):
    """
    Panel 3 Mock Interview:
    Prompts Groq LLM for ONE new technical interview question tailored to the role and prior history (§6).
    """
    role = payload.role.strip() or "Software Engineer (Backend)"
    history = payload.history or ""
    prompt = get_interview_question_prompt(role, history)

    try:
        raw_output = call_llm(prompt, max_tokens=250)
        parsed = parse_json_safely(raw_output)
        question = parsed.get("question", "") if isinstance(parsed, dict) else str(parsed)
        if not question or not question.strip():
            raise ValueError("Empty question returned by LLM")
        return {
            "role": role,
            "question": question.strip()
        }
    except Exception as e:
        err_msg = str(e)
        if "rate limit" in err_msg.lower() or "429" in err_msg:
            raise HTTPException(status_code=429, detail="Rate limited by Groq API. Please retry in a few seconds.")
        fallbacks = {
            "Software Engineer (Backend)": "Can you explain how database indexing works and when an index might degrade performance?",
            "Frontend Engineer": "How does React's virtual DOM reconciliation algorithm optimize rendering performance?",
            "Full Stack Developer": "How do you handle authentication, state persistence, and API error states between frontend and backend?",
        }
        fallback_q = fallbacks.get(role, f"What are the key architectural tradeoffs when designing a high-scale service in {role}?")
        return {"role": role, "question": fallback_q}

@app.post("/api/interview/evaluate")
def evaluate_interview_answer(payload: InterviewEvaluateRequest):
    """
    Panel 3 Mock Interview Evaluation:
    Evaluates candidate answer, scores correctness, clarity, completeness (1-10),
    generates a model answer (max 120 words), and a constructive tip (§6).
    Persists evaluation to SQLite and returns mean score.
    """
    role = payload.role.strip() or "Software Engineer (Backend)"
    question = payload.question.strip()
    answer = payload.answer.strip()

    if not answer:
        raise HTTPException(status_code=400, detail="Answer cannot be empty.")

    prompt = get_interview_eval_prompt(question, answer)
    try:
        raw_output = call_llm(prompt, max_tokens=600)
        parsed = parse_json_safely(raw_output)

        correctness = int(parsed.get("correctness", 7))
        clarity = int(parsed.get("clarity", 7))
        completeness = int(parsed.get("completeness", 7))
        model_answer = str(parsed.get("model_answer", "")).strip()
        tip = str(parsed.get("tip", "")).strip()

        # Clamp scores 1-10
        correctness = max(1, min(10, correctness))
        clarity = max(1, min(10, clarity))
        completeness = max(1, min(10, completeness))
        mean_score = round((correctness + clarity + completeness) / 3.0, 1)

        # Persist to SQLite
        save_interview_score(role, question, answer, correctness, clarity, completeness, mean_score)

        return {
            "role": role,
            "correctness": correctness,
            "clarity": clarity,
            "completeness": completeness,
            "mean_score": mean_score,
            "model_answer": model_answer,
            "tip": tip
        }
    except Exception as e:
        err_msg = str(e)
        if "rate limit" in err_msg.lower() or "429" in err_msg:
            raise HTTPException(status_code=429, detail="Rate limited by Groq API. Please retry in a few seconds.")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate interview answer: {err_msg}")

@app.get("/api/interview/progress")
def get_interview_progress():
    """
    Returns mean interview score and recent interview logs.
    """
    return {
        "mean_interview_score": get_mean_interview_score(),
        "recent_interviews": get_all_interview_scores()
    }

# ==================== STEP 6: PROGRESS & READINESS ENDPOINT ====================

@app.get("/api/progress")
def get_dashboard_progress():
    """
    Panel 4 Progress & Readiness endpoint (§4, §2.1, D10, D11):
    Returns:
      - ATS score
      - Per-topic accuracy across standard topics (DBMS, OS, DSA, CN, OOP, Aptitude)
      - Mean interview score
      - Readiness score (0-100) and category (rule-based formula D10)
      - The 3 weakest topics recommended next (D11)
    """
    last_ats = get_last_ats_score()
    topic_accuracies = get_topic_accuracies()
    mean_interview = get_mean_interview_score()
    quiz_attempts = get_all_quiz_attempts()
    interview_evals = get_all_interview_scores()

    attempted_topics = [stats["accuracy"] for stats in topic_accuracies.values() if stats["attempts"] > 0]
    has_quiz_activity = len(attempted_topics) > 0
    avg_topic_accuracy = round(sum(attempted_topics) / len(attempted_topics), 1) if has_quiz_activity else 0.0

    readiness = calculate_readiness_score(
        avg_topic_accuracy=avg_topic_accuracy,
        mean_interview_score=mean_interview,
        last_ats_score=last_ats,
        has_quiz_activity=has_quiz_activity,
    )

    recommendations = get_weakest_topics(topic_accuracies, count=3)

    return {
        "ats_score": last_ats,
        "topic_accuracies": topic_accuracies,
        "avg_topic_accuracy": avg_topic_accuracy if has_quiz_activity else None,
        "mean_interview_score": mean_interview,
        "readiness": readiness,
        "recommendations": recommendations,
        "total_quiz_attempts": len(quiz_attempts),
        "total_interview_evaluations": len(interview_evals),
    }

# ==================== STEP 7: DEMO DATA RESET ENDPOINT ====================

@app.post("/api/reset")
def reset_demo_data():
    """
    Step 7 Polish: Returns the dashboard to a clean demo state (§7.7, §10).
    Clears last ATS score, quiz attempts, and interview scores from SQLite.
    """
    reset_db()
    return {"ok": True, "message": "Demo data reset successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
