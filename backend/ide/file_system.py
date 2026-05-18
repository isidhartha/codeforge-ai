"""Virtual file system operations — list, read, write files safely."""
import os
from pathlib import Path
from typing import Optional
import aiofiles
import chardet
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import FileInfo

logger = get_logger(__name__)
settings = get_settings()

IGNORED_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}
IGNORED_EXTENSIONS = {".pyc", ".pyo", ".class", ".o", ".so", ".dll", ".exe"}


def _workspace_root() -> Path:
    return Path(settings.workspace_dir)


def _safe_path(rel_path: str) -> Path:
    """Resolve path and ensure it stays within the workspace."""
    root = _workspace_root().resolve()
    candidate = (root / rel_path.lstrip("/")).resolve()
    if not str(candidate).startswith(str(root)):
        raise PermissionError(f"Path '{rel_path}' escapes workspace boundary")
    return candidate


def list_files(rel_dir: str = "") -> list[FileInfo]:
    """List files and directories in the given workspace-relative path."""
    target = _safe_path(rel_dir)
    if not target.exists():
        return []

    results: list[FileInfo] = []
    for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
        if entry.name.startswith(".") or entry.name in IGNORED_DIRS:
            continue
        if entry.is_file() and entry.suffix in IGNORED_EXTENSIONS:
            continue
        try:
            size = entry.stat().st_size if entry.is_file() else 0
        except OSError:
            size = 0

        results.append(FileInfo(
            path=str(entry.relative_to(_workspace_root())).replace("\\", "/"),
            name=entry.name,
            is_dir=entry.is_dir(),
            size=size,
            extension=entry.suffix if entry.is_file() else "",
        ))
    return results


async def read_file(rel_path: str) -> tuple[str, str]:
    """Return (content, encoding) of a workspace file."""
    path = _safe_path(rel_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {rel_path}")
    if not path.is_file():
        raise IsADirectoryError(f"Path is a directory: {rel_path}")

    raw = path.read_bytes()
    detected = chardet.detect(raw)
    encoding = detected.get("encoding") or "utf-8"
    content = raw.decode(encoding, errors="replace")
    return content, encoding


async def write_file(rel_path: str, content: str, encoding: str = "utf-8") -> None:
    """Write content to a workspace file, creating directories as needed."""
    path = _safe_path(rel_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "w", encoding=encoding) as fh:
        await fh.write(content)
    logger.info("file_written", path=rel_path, size=len(content))
