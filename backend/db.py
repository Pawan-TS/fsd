import sqlite3
from pathlib import Path
from typing import Optional, Dict, Any, List

DB_PATH = Path(__file__).resolve().parent / "placement_demo.sqlite3"

STANDARD_TOPICS = ["DBMS", "OS", "DSA", "CN", "OOP", "Aptitude"]

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Table for storing ATS demo state
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS demo_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_ats_score REAL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Table for quiz attempts (Step 4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        correct_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        accuracy REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Table for interview evaluations (Step 5)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS interview_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        question TEXT NOT NULL,
        candidate_answer TEXT,
        correctness INTEGER NOT NULL,
        clarity INTEGER NOT NULL,
        completeness INTEGER NOT NULL,
        mean_score REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Ensure id=1 exists in demo_state
    cursor.execute("INSERT OR IGNORE INTO demo_state (id, last_ats_score) VALUES (1, NULL)")
    conn.commit()
    conn.close()

def save_last_ats_score(score: float):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE demo_state SET last_ats_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1", (score,))
    conn.commit()
    conn.close()

def get_last_ats_score() -> Optional[float]:
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT last_ats_score FROM demo_state WHERE id = 1").fetchone()
    conn.close()
    if row and row["last_ats_score"] is not None:
        return float(row["last_ats_score"])
    return None

def save_quiz_attempt(topic: str, correct_count: int, total_count: int, accuracy: float) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO quiz_attempts (topic, correct_count, total_count, accuracy) VALUES (?, ?, ?, ?)",
        (topic, correct_count, total_count, accuracy),
    )
    attempt_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return attempt_id

def get_topic_accuracies() -> Dict[str, Dict[str, Any]]:
    """
    Returns accuracy and attempt count for each standard topic.
    Topics with no attempts have accuracy 0.0 (D11).
    """
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT topic, AVG(accuracy) as avg_accuracy, COUNT(*) as attempts FROM quiz_attempts GROUP BY topic"
    ).fetchall()
    conn.close()
    
    data = {t: {"accuracy": 0.0, "attempts": 0} for t in STANDARD_TOPICS}
    for r in rows:
        top = r["topic"]
        if top in data:
            data[top] = {
                "accuracy": round(float(r["avg_accuracy"]), 1),
                "attempts": int(r["attempts"]),
            }
        else:
            data[top] = {
                "accuracy": round(float(r["avg_accuracy"]), 1),
                "attempts": int(r["attempts"]),
            }
    return data

def get_all_quiz_attempts() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, topic, correct_count, total_count, accuracy, created_at FROM quiz_attempts ORDER BY id DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def save_interview_score(
    role: str,
    question: str,
    candidate_answer: str,
    correctness: int,
    clarity: int,
    completeness: int,
    mean_score: float,
) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO interview_scores (role, question, candidate_answer, correctness, clarity, completeness, mean_score)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (role, question, candidate_answer, correctness, clarity, completeness, mean_score),
    )
    score_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return score_id

def get_mean_interview_score() -> Optional[float]:
    """
    Returns the average mean_score across all interview answers evaluated.
    """
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT AVG(mean_score) as avg_score, COUNT(*) as cnt FROM interview_scores").fetchone()
    conn.close()
    if row and row["cnt"] > 0 and row["avg_score"] is not None:
        return round(float(row["avg_score"]), 1)
    return None

def get_all_interview_scores() -> List[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT id, role, question, candidate_answer, correctness, clarity, completeness, mean_score, created_at FROM interview_scores ORDER BY id DESC LIMIT 20"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def reset_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE demo_state SET last_ats_score = NULL WHERE id = 1")
    cursor.execute("DELETE FROM quiz_attempts")
    cursor.execute("DELETE FROM interview_scores")
    conn.commit()
    conn.close()

# Initialize tables
init_db()
