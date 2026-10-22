# AI Placement-Prep Portal (Demo Prototype)

A lightweight, single-page AI dashboard prototype demonstrating core campus placement preparation workflows end-to-end for engineering students.

Built following **`PROJECT_PLAN.md`** using FastAPI, local SQLite, React 19, Tailwind CSS, Recharts, and Groq's high-speed inference engine (`openai/gpt-oss-120b`).

---

##  Quickstart (2 Commands to Run)

### 1. Prerequisites & Environment Setup
- Python 3.10+
- Node.js 18+
- Free Groq API Key (get one instantly at [console.groq.com](https://console.groq.com/))

Copy `.env.example` to `.env` and set your Groq API key:
```bash
cp .env.example .env
```
Inside `.env`:
```ini
GROQ_API_KEY=gsk_your_actual_key_here
LLM_MODEL=openai/gpt-oss-120b
```

---

### 2. Run Backend (Terminal 1)
```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --port 8000 --reload
```
The FastAPI backend runs on `http://127.0.0.1:8000` with Swagger UI at `http://127.0.0.1:8000/docs`.

---

### 3. Run Frontend (Terminal 2)
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.

---

##  The 4 Dashboard Panels

| # | Panel | Core AI & Logic Implementation |
|---|---|---|
| **1** | **Resume vs JD Analysis** | Computes semantic similarity using `sentence-transformers/all-MiniLM-L6-v2` embeddings, extracts skills via boundary-safe dictionary matching, evaluates ATS score ($100 \times [0.6 \times \text{cosine} + 0.4 \times \text{coverage}]$), and queries Groq for 5 targeted resume improvement tips. Supports optional PDF resume extraction. |
| **2** | **AI Practice Test** | Generates tailored placement MCQs on 6 core engineering subjects (`DBMS`, `OS`, `DSA`, `CN`, `OOP`, `Aptitude`) with Groq `openai/gpt-oss-120b`. Submissions record per-topic accuracy, calculate scores, and display detailed explanations. |
| **3** | **AI Mock Interview** | 5-question sequential technical interview loop across customizable software engineering roles. Evaluates candidate answers on 1–10 integer scales for correctness, clarity, and completeness, with model answers (max 120 words) and coaching tips. |
| **4** | **Progress & Readiness** | Visualizes per-topic performance via Recharts, calculates transparent rule-based readiness score (Locked Decision D10), assigns status badge (`Ready`, `Moderately ready`, `Not ready`), and identifies the 3 weakest topics as recommended next practice (D11). |

---

##  5-Minute Demo Flow

1. **Test Resume ATS Matching (Panel 1):**
   - Click **"Analyze Match & Suggestions"** with the pre-filled matching Backend Engineer resume and JD $\rightarrow$ Observe high score (~95%), matched skills, and 5 AI recommendations.
   - Click **"Load Unrelated JD (Graphic Designer)"** and re-run $\rightarrow$ Observe score drop to ~14% with 0% skill coverage.
2. **Take an AI Practice Quiz (Panel 2):**
   - Select a topic (e.g. `DSA` or `DBMS`) and question count $\rightarrow$ Click **"Generate MCQs"**.
   - Select answers and click **"Submit Test"** $\rightarrow$ Review instant accuracy badge, correct/incorrect highlights, and explanations.
3. **Conduct a Mock Interview (Panel 3):**
   - Select role (e.g. *Software Engineer (Backend)*) $\rightarrow$ Click **"Start 5-Question Interview"**.
   - Review Question 1, paste or type an answer (or click *"Paste Sample Technical Answer"* for speed), and click **"Submit Answer for Evaluation"**.
   - Review 1–10 rubric scores, model answer, and coaching tip. Step through the remaining questions to complete the session.
4. **Inspect Placement Readiness & Weakest Topics (Panel 4):**
   - View the updated **Placement Readiness Score** and **Per-Topic Accuracy** bar chart.
   - Click any recommended subject under **"Recommended Next Practice (3 Weakest Topics)"** $\rightarrow$ Panel 2 automatically pre-selects that topic and smoothly scrolls into view for instant targeted practice.

---

##  Architecture & Tech Stack

```
fsd/
├── PROJECT_PLAN.md        # Source-of-truth demo specifications
├── NOTES.md               # Implementation log & decisions
├── README.md              # Setup & run instructions
├── .env.example           # Example config (never commit real keys)
├── backend/
│   ├── main.py            # FastAPI endpoints (health, analyze, quiz, interview, progress)
│   ├── db.py              # Local SQLite persistence (placement_demo.sqlite3)
│   ├── ai/
│   │   ├── llm.py         # Groq client wrapper with JSON mode & token capping
│   │   ├── embed.py       # Sentence-transformers (MiniLM-L6-v2) & ATS formula
│   │   ├── skills.py      # Boundary regex skill matcher
│   │   ├── prompts.py     # Prompt templates for MCQs, interview, and resume
│   │   └── readiness.py   # D10 readiness formula & D11 weakest topic ranking
│   ├── data/skills.json   # Curated placement skills dictionary
│   └── requirements.txt   # Backend Python dependencies
└── frontend/
    └── src/
        ├── App.jsx        # Main single-page dashboard layout & health checker
        └── panels/        # 4 core dashboard panels
            ├── ResumePanel.jsx
            ├── QuizPanel.jsx
            ├── InterviewPanel.jsx
            └── ProgressPanel.jsx
```

---

##  Known Demo Shortcuts (§9)

- **Single-User Demo:** Local prototype without multi-user authentication, accounts, or PII redaction. Do not enter real sensitive personal contact info.
- **Rule-Based Readiness:** Readiness score is calculated via an explicit weighted formula ($0.35 \times \text{quiz} + 0.30 \times \text{interview} + 0.25 \times \text{ATS} + 0.10 \times 100$), not a trained ML predictive model.
- **AI Scoring:** Feedback and generated questions are practice tools produced by Groq `openai/gpt-oss-120b` and have not been calibrated by human psychometric evaluators.
- **Local Storage:** State is stored in a local SQLite file (`placement_demo.sqlite3`).
