from typing import Optional, Dict, Any, List

# Locked Decision D10 Weights
WEIGHTS = {
    "quiz": 0.35,        # avg topic accuracy (0-100)
    "interview": 0.30,   # mean interview score scaled to 0-100 (mean / 10 * 100)
    "ats": 0.25,         # ATS score (0-100)
    "baseline": 0.10,    # baseline completion factor (100)
}

def calculate_readiness_score(
    avg_topic_accuracy: Optional[float],
    mean_interview_score: Optional[float],
    last_ats_score: Optional[float],
    has_quiz_activity: bool = False
) -> Dict[str, Any]:
    """
    Transparent rule-based formula for student readiness based on Locked Decision D10.
    Missing components are skipped and weights are renormalized.
    Categories:
      - Under 40: Not ready
      - 40-70: Moderately ready
      - Over 70: Ready
      - No activity: Not enough data yet
    """
    active_components = {}
    
    if has_quiz_activity and avg_topic_accuracy is not None:
        active_components["quiz"] = (avg_topic_accuracy, WEIGHTS["quiz"])
        
    if mean_interview_score is not None:
        # Scale 1-10 to 0-100
        interview_pct = min(100.0, max(0.0, mean_interview_score * 10.0))
        active_components["interview"] = (interview_pct, WEIGHTS["interview"])
        
    if last_ats_score is not None:
        active_components["ats"] = (last_ats_score, WEIGHTS["ats"])

    # If no real activity exists, return "Not enough data yet"
    if not active_components:
        return {
            "score": None,
            "category": "Not enough data yet",
            "active_components": {},
            "label": "demo estimate, not a prediction"
        }

    # Include baseline factor if at least one activity has been conducted
    active_components["baseline"] = (100.0, WEIGHTS["baseline"])

    # Renormalize weights
    total_weight = sum(w for _, w in active_components.values())
    raw_score = sum(val * (w / total_weight) for val, w in active_components.values())
    final_score = round(min(100.0, max(0.0, raw_score)), 1)

    if final_score < 40.0:
        category = "Not ready"
    elif final_score <= 70.0:
        category = "Moderately ready"
    else:
        category = "Ready"

    return {
        "score": final_score,
        "category": category,
        "active_components": {k: {"value": round(v, 1), "weight": round(w / total_weight, 2)} for k, (v, w) in active_components.items()},
        "label": "demo estimate, not a prediction"
    }

def get_weakest_topics(topic_accuracies: Dict[str, Dict[str, Any]], count: int = 3) -> List[Dict[str, Any]]:
    """
    Identify the weakest topics based on Locked Decision D11:
    The 3 topics with lowest accuracy (topics with no attempts count as 0.0).
    """
    topic_list = []
    for topic, stats in topic_accuracies.items():
        acc = float(stats.get("accuracy", 0.0))
        attempts = int(stats.get("attempts", 0))
        topic_list.append({
            "topic": topic,
            "accuracy": acc if attempts > 0 else 0.0,
            "attempts": attempts
        })

    # Sort primarily by accuracy ascending, secondarily by attempts ascending
    topic_list.sort(key=lambda t: (t["accuracy"], t["attempts"]))
    return topic_list[:count]
