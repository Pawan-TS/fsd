# Development Notes

## Build Step 1: Scaffold

### Assumptions & Simplest Options Chosen
1. **Frontend Stack**: Scaffolded with Vite + React 19 (`create-vite` JS template). Installed Tailwind CSS (`tailwindcss` + `@tailwindcss/vite`) and `recharts` as specified in §3 (D1) and §7.1.
2. **API Proxy**: Configured Vite dev server with a proxy for `/api` pointing to `http://127.0.0.1:8000`, matching FastAPI's default port. Also enabled FastAPI CORS middleware for `http://localhost:5173` to allow both direct and proxied calls.
3. **Repository Layout**:
   - `backend/requirements.txt`: specified `fastapi`, `uvicorn`, `python-dotenv`, `sentence-transformers`, `numpy`, `pymupdf`, `groq`.
   - `backend/main.py`: minimal FastAPI app with `/api/health` returning `{"ok": True}`.
   - `backend/ai/`: created module structure with empty/scaffold stubs (`skills.py`, `embed.py`, `llm.py`, `prompts.py`, `readiness.py`).
   - `backend/data/skills.json`: placeholder initialized.
   - `frontend/src/panels/`: created placeholder components for the four panels (`ResumePanel.jsx`, `QuizPanel.jsx`, `InterviewPanel.jsx`, `ProgressPanel.jsx`).
4. **Environment & Git**:
   - `.env.example` created with `GROQ_API_KEY=` and `LLM_MODEL=openai/gpt-oss-120b`.
   - `.gitignore` ignores `.env`, `.env*.local`, SQLite databases (`*.db`, `*.sqlite`, `*.sqlite3`), `node_modules`, `dist`, `__pycache__`, and virtual environments.
   - No Groq API keys are stored in any source file.

## Build Step 2: LLM Helper and Skills

### Assumptions & Simplest Options Chosen
1. **Groq Client & Parameters**:
   - `call_llm(prompt, max_tokens=1000)` reads `GROQ_API_KEY` and `LLM_MODEL` (`openai/gpt-oss-120b`) from `.env`.
   - Passes `response_format={"type": "json_object"}` and `reasoning_effort="low"` to reduce latency and token consumption per D4 and D4a.
   - Graceful fallback: handles `RateLimitError` (HTTP 429) cleanly; falls back to standard call without `reasoning_effort` or to `llama-3.3-70b-versatile` if model/params are unavailable.
2. **Skills Matching**:
   - `backend/data/skills.json` populated with ~80 engineering skills covering languages, frameworks, databases, core CS fundamentals (DSA, OS, DBMS, CN, OOP), cloud, and AI/ML.
   - `extract_skills(text)` uses case-insensitive dictionary matching with non-alphanumeric token boundary lookarounds (`(?<![a-zA-Z0-9])` and `(?![a-zA-Z0-9\+#])`). This eliminates false positive substrings (e.g. "go" in "good" or "c" in "react") while preserving symbols like "c++" and "c#".

## Build Step 3: Resume vs JD Panel

### Assumptions & Simplest Options Chosen
1. **Embeddings & ATS Score**:
   - Dense embeddings generated via `sentence-transformers/all-MiniLM-L6-v2` with in-memory cosine similarity via numpy (D6).
   - ATS score computed strictly with Locked Decision D9 formula:
     `ATS = 100 * (0.6 * max(0, cosine) + 0.4 * jd_skill_coverage)`, where `coverage = matched_jd_skills / total_jd_skills` (or 0 if none).
   - Verification confirmed matching resume against matching JD scored **95.6%**, while against an unrelated graphic design JD it scored **13.7%** (difference of +81.9 points).
2. **Groq AI Suggestions**:
   - `backend/ai/prompts.py` formats prompt with missing skills and truncated excerpts (~2000 chars) to stay safely inside Groq's 8,000 tokens/min cap (D4a).
   - Exactly 5 concrete improvement suggestions returned as JSON and displayed in UI.
   - On rate limits (HTTP 429) or JSON failures, displays graceful fallback suggestions without crashing the portal (D4a, D5).
3. **Storage & Optional PDF Upload**:
   - ATS score is persisted to SQLite table `demo_state` via `backend/db.py` for aggregation in Panel 4 / Step 6.
   - Added optional PDF upload endpoint `/api/extract-pdf` using PyMuPDF (fitz) allowing drag-and-drop or file pick to populate the resume textarea.

## Build Step 4: Practice Test Panel

### Assumptions & Simplest Options Chosen
1. **MCQ Generation Endpoint**:
   - `POST /api/quiz/generate`: generates placement multiple-choice questions for topics (`DBMS`, `OS`, `DSA`, `CN`, `OOP`, `Aptitude`).
   - Caps batch size at 5 questions per D4a to prevent token exhaustion.
   - Robust JSON sanitization handles optional code fences and validates option counts, `correct_index` (0-3), and `explanation`.
2. **Submission & Per-Topic Accuracy Persistence**:
   - `POST /api/quiz/submit`: calculates correct count and accuracy percentage, then saves attempt to `quiz_attempts` table in SQLite (`placement_demo.sqlite3`).
   - Computes updated per-topic accuracy across attempts. Unattempted topics return 0.0% accuracy per D11.
   - Added `GET /api/quiz/progress` to supply live historical and topic statistics to the dashboard.
3. **Practice Test UI (`QuizPanel.jsx`)**:
   - Allows selecting placement topic and question count.
   - Interactive test taking with selection indicator, question progress counter, and score evaluation.
   - Review view displays accuracy badge, color-coded correct/incorrect indicators, correct answer highlight, and detailed AI explanations for each question.

## Build Step 5: Mock Interview Panel

### Assumptions & Simplest Options Chosen
1. **Interactive 5-Question Flow**:
   - `POST /api/interview/next`: requests ONE targeted technical question from Groq `openai/gpt-oss-120b` incorporating previous Q&A context to avoid repetition (§6).
   - `POST /api/interview/evaluate`: assesses candidate answer, returning integers 1-10 for correctness, clarity, completeness, a model answer (max 120 words), and a constructive coaching tip (§6).
   - Anti-injection defense: prompts explicitly ignore commands embedded inside candidate answers.
2. **Persistence & Aggregated Scoring**:
   - Answers and evaluations are saved to `interview_scores` in SQLite (`placement_demo.sqlite3`).
   - `mean_score` calculated as `(correctness + clarity + completeness) / 3.0` and saved per question.
   - Added `GET /api/interview/progress` returning overall mean interview score across all sessions for Step 6 readiness aggregation.
3. **Mock Interview UI (`InterviewPanel.jsx`)**:
   - Role selector with standard software engineering tracks.
   - Step-by-step progress tracking (`Question X of 5`) with sample answer pasting for demo efficiency.
   - Real-time score cards, model answer callout, coaching tip, and final 5-question comprehensive summary view.

## Build Step 6: Progress and Readiness Panel

### Assumptions & Simplest Options Chosen
1. **Rule-Based Readiness Computation (`backend/ai/readiness.py`)**:
   - Implemented strictly with Locked Decision D10 formula:
     `0.35 * avg_topic_accuracy + 0.30 * (mean_interview / 10 * 100) + 0.25 * ATS + 0.10 * 100`.
   - Dynamic weight normalization: if any of the three historical components (Quiz, Interview, ATS) have not yet been attempted, their weight is omitted and the remaining active components (plus the 10% baseline) are renormalized so the total scale always remains 0-100.
   - If no tests, interviews, or resume matches exist at all, readiness returns `score = None` and category `"Not enough data yet"`.
   - Categorization:
     - `score >= 75`: **"Ready"**
     - `50 <= score < 75`: **"Moderately ready"**
     - `score < 50`: **"Not ready"**
   - Strictly tagged with the honest disclaimer `"demo estimate, not a prediction"` in API responses and UI displays (§9, D10).
2. **Weakest 3 Topics Recommendations (D11)**:
   - Evaluates all standard placement subjects (`DBMS`, `OS`, `DSA`, `CN`, `OOP`, `Aptitude`).
   - Unattempted topics are treated as 0.0% accuracy with 0 attempts and prioritized first.
   - Sorts ascending by accuracy, taking the bottom 3 topics to recommend next practice.
3. **Aggregated API Endpoint (`GET /api/progress`)**:
   - Gathers latest ATS score from `demo_state`, overall interview mean from `interview_scores`, and per-topic accuracies from `quiz_attempts`.
   - Computes overall average topic accuracy, readiness score, readiness category, and recommendation list in a single fast, non-LLM call.
4. **Progress UI (`ProgressPanel.jsx` & `App.jsx`)**:
   - Recharts `BarChart` visualizing per-topic accuracy across the 6 core placement subjects with color-coded bars (Rose for <40%, Amber for 40-69%, Emerald for 70%+, Slate for 0 attempts).
   - Prominent readiness score card with color badge (`Ready`, `Moderately ready`, `Not ready`) and disclaimer label.
   - Clickable cards for the 3 weakest recommended topics: clicking any recommendation switches the active topic in Panel 2 (`QuizPanel`) and scrolls smoothly to it.
   - Reactive cross-panel updates: when a test is submitted in Panel 2, an interview answered in Panel 3, or a resume analyzed in Panel 1, `ProgressPanel` automatically re-fetches and updates all charts and readiness scores live.

## Theme Customization: Light Mode Only

### Assumptions & UI Design Choices
1. **Light Mode Palette**:
   - Background set to `bg-slate-50` (`#f8fafc`) with `color-scheme: light` in `index.css`.
   - Cards styled with crisp white backgrounds (`bg-white`), subtle borders (`border-slate-200/80`), and soft shadows (`shadow-sm`, `shadow-2xs`).
   - High-contrast, accessible typography using slate scale (`text-slate-900` for titles, `text-slate-700` for body, `text-slate-500` for metadata).
2. **Component & Chart Refinements**:
   - Recharts BarChart axes adjusted to `#64748b` with grid/axis line at `#cbd5e1`; tooltips updated to pure white card background with soft shadow.
   - Unattempted topics in bar chart rendered in light slate (`#cbd5e1`).
   - Clean pastel accent badges: Emerald (`bg-emerald-50 text-emerald-800 border-emerald-200`), Violet/Indigo (`bg-indigo-50 text-indigo-700 border-indigo-200`), Pink (`bg-pink-50 text-pink-700 border-pink-200`), and Amber (`bg-amber-50 text-amber-800 border-amber-200`).


