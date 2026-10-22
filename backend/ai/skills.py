import json
import os
import re
from pathlib import Path
from typing import List, Dict

SKILLS_FILE = Path(__file__).resolve().parent.parent / "data" / "skills.json"

def load_skills_data() -> Dict[str, List[str]]:
    if not SKILLS_FILE.exists():
        return {}
    with open(SKILLS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

SKILLS_DICT = load_skills_data()

def extract_skills(text: str) -> List[str]:
    """
    Extract skills using case-insensitive dictionary matching against ~100 skills and aliases.
    Uses boundary checks to prevent false positives for short aliases (e.g. 'c', 'r', 'go').
    """
    if not text:
        return []
    
    matched = set()
    text_lower = text.lower()
    
    for skill, aliases in SKILLS_DICT.items():
        # Check canonical skill name and all aliases
        candidates = [skill.lower()] + [a.lower() for a in aliases]
        for cand in candidates:
            # Boundary check: ensure candidate is not part of a larger alphanumeric/code token
            pattern = rf"(?<![a-zA-Z0-9]){re.escape(cand)}(?![a-zA-Z0-9\+#])"
            if re.search(pattern, text_lower):
                matched.add(skill)
                break
                
    return sorted(list(matched))
