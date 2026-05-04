import logging
import time
import re
import functools
from difflib import SequenceMatcher
from typing import Optional


def setup_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%H:%M:%S",
    )


_ROMAN = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5",
    "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10",
    "xi": "11", "xii": "12", "xiii": "13", "xiv": "14", "xv": "15",
    "xvi": "16",
}

_ROMAN_PATTERN = re.compile(
    r"\b(x{0,3})(ix|iv|v?i{0,3})\b", re.IGNORECASE
)


def _replace_roman(match: re.Match) -> str:
    token = match.group(0).lower()
    return _ROMAN.get(token, token)


def normalize_title(title: str) -> str:
    """Lowercase, strip leading 'the ', convert Roman numerals, remove punctuation."""
    t = str(title).lower().strip()
    t = re.sub(r"^the\s+", "", t)
    # convert roman numerals to arabic so "VII" == "7" when matching
    t = _ROMAN_PATTERN.sub(_replace_roman, t)
    t = re.sub(r"[^\w\s]", "", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def fuzzy_match_score(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def best_fuzzy_match(
    query: str,
    candidates: list,
    threshold: float = 0.80,
) -> tuple:
    """Return (best_candidate, score) above threshold, or (None, 0.0)."""
    query_norm = normalize_title(query)
    best_candidate = None
    best_score = 0.0
    for candidate in candidates:
        score = fuzzy_match_score(query_norm, normalize_title(str(candidate)))
        if score > best_score:
            best_score = score
            best_candidate = candidate
    if best_score >= threshold:
        return best_candidate, best_score
    return None, best_score


def retry(max_attempts: int = 3, backoff_base: float = 2.0):
    """Retry decorator with exponential backoff on requests.RequestException."""
    import requests

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            logger = logging.getLogger(func.__module__)
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except requests.RequestException as exc:
                    if attempt == max_attempts:
                        raise
                    delay = backoff_base ** attempt
                    logger.warning(
                        "%s attempt %d/%d failed (%s). Retrying in %.1fs.",
                        func.__name__, attempt, max_attempts, exc, delay,
                    )
                    time.sleep(delay)
        return wrapper
    return decorator


def rate_limited(calls_per_second: float = 1.0):
    """Enforce a minimum delay between calls to the decorated function."""
    min_interval = 1.0 / calls_per_second
    last_called = [0.0]

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            elapsed = time.monotonic() - last_called[0]
            if elapsed < min_interval:
                time.sleep(min_interval - elapsed)
            result = func(*args, **kwargs)
            last_called[0] = time.monotonic()
            return result
        return wrapper
    return decorator
