import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
import groq
from groq import Groq, RateLimitError, APIError

# Load environment variables from .env
env_file = find_dotenv(usecwd=True)
if not env_file:
    # Try looking in parent directories
    parent_env = Path(__file__).resolve().parent.parent.parent / ".env"
    if parent_env.exists():
        env_file = str(parent_env)

if env_file:
    load_dotenv(env_file)
else:
    load_dotenv()

DEFAULT_MODEL = "openai/gpt-oss-120b"
FALLBACK_MODEL = "llama-3.3-70b-versatile"

def get_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set. Please add it to your .env file.")
    return Groq(api_key=api_key)

def call_llm(prompt: str, max_tokens: int = 1000) -> str:
    """
    Calls Groq LLM with the provided prompt.
    Requests JSON mode and low reasoning effort to optimize latency and token use (D4, D4a).
    Gracefully handles rate limits (HTTP 429) and parameter/model fallbacks.
    """
    client = get_client()
    model = os.getenv("LLM_MODEL", DEFAULT_MODEL)
    messages = [{"role": "user", "content": prompt}]

    # Attempt 1: Preferred configuration with json mode and low reasoning effort
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
            reasoning_effort="low",
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except RateLimitError as e:
        raise RuntimeError("Rate limited by Groq API. Please retry in a few seconds.") from e
    except APIError as e:
        # If model or parameter is rejected, try without reasoning_effort
        pass

    # Attempt 2: Without reasoning_effort
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except RateLimitError as e:
        raise RuntimeError("Rate limited by Groq API. Please retry in a few seconds.") from e
    except APIError:
        pass

    # Attempt 3: Fallback model
    try:
        response = client.chat.completions.create(
            model=FALLBACK_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content or ""
    except RateLimitError as e:
        raise RuntimeError("Rate limited by Groq API. Please retry in a few seconds.") from e
    except Exception as e:
        raise RuntimeError(f"LLM call failed: {str(e)}") from e
