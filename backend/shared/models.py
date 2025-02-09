"""Shared Pydantic models for request/response schemas."""
from typing import Any, Optional
from pydantic import BaseModel, Field


# ---------- AI Models ----------

class CompletionRequest(BaseModel):
    code: str = Field(..., description="Current code context")
    language: str = Field(default="python", description="Programming language")
    cursor_position: int = Field(default=0, description="Cursor position in code")
    file_path: Optional[str] = None


class ExplainRequest(BaseModel):
    code: str = Field(..., description="Code block to explain")
    language: str = Field(default="python")
    context: Optional[str] = Field(None, description="Surrounding file context")


class GenerateRequest(BaseModel):
    spec: str = Field(..., description="Natural language description of what to generate")
    language: str = Field(default="python")
    context: Optional[str] = Field(None, description="Existing code context")
    file_path: Optional[str] = None


class DebugRequest(BaseModel):
    error: str = Field(..., description="Error message or traceback")
    code: str = Field(default="", description="Code that caused the error")
    language: str = Field(default="python")


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    selected_code: Optional[str] = None
    language: Optional[str] = None
    file_path: Optional[str] = None


# ---------- Terminal Models ----------

class TerminalRunRequest(BaseModel):
    command: str = Field(..., description="Shell command to execute")
    working_dir: Optional[str] = None
    timeout: int = Field(default=30, ge=1, le=120)


class TerminalNLRequest(BaseModel):
    query: str = Field(..., description="Natural language description of desired action")
    working_dir: Optional[str] = None


class TerminalRunResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    command: str
    duration_ms: float


class TerminalNLResponse(BaseModel):
    command: str
    explanation: str
    safe: bool


# ---------- Project Models ----------

class IndexRequest(BaseModel):
    directory: str = Field(..., description="Directory path to index")
    extensions: list[str] = Field(
        default=[".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java", ".cpp", ".c", ".h"],
        description="File extensions to index",
    )


class SearchRequest(BaseModel):
    query: str = Field(..., description="Semantic search query")
    directory: str = Field(default="", description="Directory to search in")
    limit: int = Field(default=10, ge=1, le=50)


class SearchResult(BaseModel):
    file_path: str
    snippet: str
    score: float
    line_start: int
    line_end: int


class SearchResponse(BaseModel):
    results: list[SearchResult]
    query: str
    total: int


# ---------- File Models ----------

class FileWriteRequest(BaseModel):
    content: str
    encoding: str = "utf-8"


class FileInfo(BaseModel):
    path: str
    name: str
    is_dir: bool
    size: int
    extension: str


# ---------- Generic ----------

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[Any] = None


class SuccessResponse(BaseModel):
    message: str
    data: Optional[Any] = None
