import numpy as np
from sentence_transformers import SentenceTransformer

_model = None

def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def get_embedding(text: str) -> np.ndarray:
    """
    Generate normalized 384-dimensional dense embedding using all-MiniLM-L6-v2 (D6).
    Truncates text to ~1500 words to maintain optimal embedding performance.
    """
    if not text or not text.strip():
        return np.zeros(384, dtype=np.float32)
    model = get_embedding_model()
    # Truncate text if needed
    cleaned = " ".join(text.split()[:1500])
    return model.encode(cleaned, convert_to_numpy=True, normalize_embeddings=True)

def compute_cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """
    Compute cosine similarity in memory using numpy (D6).
    """
    norm1 = float(np.linalg.norm(vec1))
    norm2 = float(np.linalg.norm(vec2))
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return float(np.dot(vec1, vec2) / (norm1 * norm2))

def compute_ats_score(cosine_similarity: float, matched_skills_count: int, total_jd_skills_count: int) -> float:
    """
    Locked Decision D9:
    ATS score: 100 * (0.6 * max(0, cosine) + 0.4 * jd_skill_coverage);
    coverage = matched JD skills / JD skills (0 if none).
    """
    coverage = (matched_skills_count / total_jd_skills_count) if total_jd_skills_count > 0 else 0.0
    ats = 100.0 * (0.6 * max(0.0, cosine_similarity) + 0.4 * coverage)
    return round(ats, 1)
