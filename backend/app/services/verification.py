"""In-memory verification code storage with TTL and rate limiting."""
import time
import random
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CodeEntry:
    code: str
    purpose: str
    created_at: float


class VerificationStore:
    TTL_SECONDS = 5 * 60  # 5 minutes
    COOLDOWN_SECONDS = 60  # 60s between sends

    def __init__(self):
        self._store: dict[str, CodeEntry] = {}
        self._last_sent: dict[str, float] = {}

    def _key(self, purpose: str, email: str) -> str:
        return f"{purpose}:{email.lower().strip()}"

    def generate_code(self, purpose: str, email: str) -> str | None:
        """Generate a 6-digit code. Returns None if rate-limited."""
        key = self._key(purpose, email)
        email_key = email.lower().strip()
        now = time.time()

        last = self._last_sent.get(email_key, 0)
        if now - last < self.COOLDOWN_SECONDS:
            return None

        code = f"{random.randint(0, 999999):06d}"
        self._store[key] = CodeEntry(code=code, purpose=purpose, created_at=now)
        self._last_sent[email_key] = now
        return code

    def verify_code(self, purpose: str, email: str, code: str) -> bool:
        """Verify and consume a code. One-time use."""
        self._cleanup_expired()
        key = self._key(purpose, email)
        entry = self._store.get(key)
        if not entry:
            return False
        if time.time() - entry.created_at > self.TTL_SECONDS:
            del self._store[key]
            return False
        if entry.code != code:
            return False
        del self._store[key]
        return True

    def _cleanup_expired(self):
        now = time.time()
        expired = [k for k, v in self._store.items() if now - v.created_at > self.TTL_SECONDS]
        for k in expired:
            del self._store[k]


verification_store = VerificationStore()
