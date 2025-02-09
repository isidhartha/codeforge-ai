"""Safe subprocess terminal with allowlist, timeout, and streaming."""
import asyncio
import shlex
import time
from pathlib import Path
from typing import AsyncIterator, Optional
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import TerminalRunRequest, TerminalRunResponse

logger = get_logger(__name__)
settings = get_settings()


class CommandNotAllowedError(Exception):
    pass


def _validate_command(command: str, allowed: list[str]) -> None:
    """Raise if the base command is not in the allowlist."""
    try:
        parts = shlex.split(command)
    except ValueError as exc:
        raise ValueError(f"Invalid command syntax: {exc}") from exc

    if not parts:
        raise ValueError("Empty command")

    base = Path(parts[0]).name
    if base not in allowed:
        raise CommandNotAllowedError(
            f"Command '{base}' is not allowed. Allowed: {', '.join(sorted(allowed))}"
        )


async def run_command(req: TerminalRunRequest) -> TerminalRunResponse:
    """Execute a shell command and return its output."""
    allowed = settings.allowed_commands
    _validate_command(req.command, allowed)

    working_dir = req.working_dir or settings.workspace_dir
    start = time.monotonic()

    logger.info("running_command", command=req.command, cwd=working_dir)

    try:
        proc = await asyncio.create_subprocess_shell(
            req.command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=working_dir,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            proc.communicate(), timeout=req.timeout
        )
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        return TerminalRunResponse(
            stdout="",
            stderr=f"Command timed out after {req.timeout}s",
            exit_code=124,
            command=req.command,
            duration_ms=(time.monotonic() - start) * 1000,
        )

    duration_ms = (time.monotonic() - start) * 1000
    return TerminalRunResponse(
        stdout=stdout_bytes.decode("utf-8", errors="replace"),
        stderr=stderr_bytes.decode("utf-8", errors="replace"),
        exit_code=proc.returncode or 0,
        command=req.command,
        duration_ms=duration_ms,
    )


async def stream_command(command: str, working_dir: Optional[str] = None) -> AsyncIterator[str]:
    """Stream command output line-by-line (for WebSocket terminal)."""
    allowed = settings.allowed_commands
    _validate_command(command, allowed)

    cwd = working_dir or settings.workspace_dir
    proc = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=cwd,
    )

    assert proc.stdout is not None
    async for line in proc.stdout:
        yield line.decode("utf-8", errors="replace")

    await proc.wait()
    yield f"\n[Process exited with code {proc.returncode}]\n"
