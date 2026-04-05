"""Prompt version registry — SHA256 hash verification prevents silent prompt edits."""
from __future__ import annotations

import hashlib
from pathlib import Path


class PromptTamperedError(Exception):
    """Raised when a prompt file's hash does not match the registry."""


# Populated at build time — run `python -m ai.prompts.compute_hashes` to update
PROMPT_HASHES: dict[tuple[str, int], str] = {}


def _compute_hash(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def _populate_hashes() -> None:
    """Compute hashes for all registered prompts on first import."""
    global PROMPT_HASHES
    base = Path(__file__).parent / "v1"
    for name in ("diagnostic", "scenario", "companion", "orchestrator"):
        p = base / f"{name}.txt"
        if p.exists():
            PROMPT_HASHES[(name, 1)] = _compute_hash(p)


_populate_hashes()


class PromptRegistry:
    """Loads and validates prompt files by name and version."""

    _base = Path(__file__).parent

    @classmethod
    def get(cls, name: str, version: int) -> str:
        """Return prompt text, verifying SHA256 hash against registry."""
        path = cls._base / f"v{version}" / f"{name}.txt"
        if not path.exists():
            raise FileNotFoundError(f"Prompt not found: {name} v{version} at {path}")

        text = path.read_text(encoding="utf-8")
        actual_hash = "sha256:" + hashlib.sha256(text.encode()).hexdigest()
        expected_hash = PROMPT_HASHES.get((name, version))

        if expected_hash and actual_hash != expected_hash:
            raise PromptTamperedError(
                f"Prompt {name} v{version} hash mismatch — "
                f"file was modified without a version bump. "
                f"Expected: {expected_hash[:20]}... Got: {actual_hash[:20]}..."
            )

        return text
