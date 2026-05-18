"""Language Server Protocol bridge — forwards LSP messages between frontend and language servers."""
import asyncio
import json
from typing import Optional
from shared.logging import get_logger

logger = get_logger(__name__)

# Supported LSP language servers
LSP_SERVERS: dict[str, list[str]] = {
    "python": ["pylsp"],
    "typescript": ["typescript-language-server", "--stdio"],
    "javascript": ["typescript-language-server", "--stdio"],
    "go": ["gopls"],
    "rust": ["rust-analyzer"],
}


class LSPBridge:
    """Manages a language server subprocess and proxies LSP JSON-RPC messages."""

    def __init__(self, language: str) -> None:
        self.language = language
        self._proc: Optional[asyncio.subprocess.Process] = None

    async def start(self) -> bool:
        """Start the language server for the configured language."""
        cmd = LSP_SERVERS.get(self.language)
        if not cmd:
            logger.warning("lsp_not_supported", language=self.language)
            return False

        try:
            self._proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )
            logger.info("lsp_started", language=self.language, pid=self._proc.pid)
            return True
        except FileNotFoundError:
            logger.warning("lsp_binary_not_found", cmd=cmd[0])
            return False

    async def send(self, message: dict) -> None:
        """Send a JSON-RPC message to the language server."""
        if not self._proc or not self._proc.stdin:
            return
        body = json.dumps(message)
        header = f"Content-Length: {len(body)}\r\n\r\n"
        self._proc.stdin.write((header + body).encode())
        await self._proc.stdin.drain()

    async def receive(self) -> Optional[dict]:
        """Read one JSON-RPC message from the language server."""
        if not self._proc or not self._proc.stdout:
            return None
        header_line = await self._proc.stdout.readline()
        if not header_line:
            return None
        length = int(header_line.decode().split(":")[1].strip())
        await self._proc.stdout.readline()  # blank line
        body = await self._proc.stdout.read(length)
        return json.loads(body)

    async def stop(self) -> None:
        """Terminate the language server process."""
        if self._proc:
            self._proc.terminate()
            try:
                await asyncio.wait_for(self._proc.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._proc.kill()
            logger.info("lsp_stopped", language=self.language)
