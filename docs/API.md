# CodeForge AI API Reference

Base URL: `http://localhost:8000`

## Health

### GET /health
```json
{"status": "ok", "service": "CodeForge AI"}
```

## AI

### POST /api/v1/ai/complete
AI code completion (streaming).

**Request:**
```json
{
  "code": "def calculate_fibonacci(",
  "language": "python",
  "cursor_position": 25
}
```

**Response:** `text/event-stream` streaming tokens.

### POST /api/v1/ai/explain
Explain selected code.

**Request:**
```json
{
  "code": "result = [x**2 for x in range(10) if x % 2 == 0]",
  "language": "python"
}
```

### POST /api/v1/ai/generate
Generate code from natural language spec.

**Request:**
```json
{
  "spec": "A FastAPI endpoint that accepts a list of integers and returns their sorted unique values",
  "language": "python",
  "context": "existing_imports.py"
}
```

### POST /api/v1/ai/debug
Debug an error.

**Request:**
```json
{
  "code": "...",
  "error": "AttributeError: 'NoneType' object has no attribute 'split'",
  "language": "python"
}
```

### POST /api/v1/ai/chat
General coding chat (streaming).

## Terminal

### POST /api/v1/terminal/run
```json
{"command": "python --version"}
```

### POST /api/v1/terminal/nl
Natural language to command.
```json
{"query": "list all python files modified today"}
```

## Files

### GET /api/v1/files
List files in workspace.

### GET /api/v1/files/{path}
Read file content.

### PUT /api/v1/files/{path}
Write file content.

## Project

### POST /api/v1/project/index
Index project for semantic search.

### POST /api/v1/project/search
```json
{"query": "database connection handling"}
```

## WebSocket

### WS /ws/ai-stream
Streaming AI responses.

### WS /ws/terminal
Interactive terminal session.
