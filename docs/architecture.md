# CodeForge AI Architecture

## Overview

CodeForge AI is a browser-based IDE powered by Monaco Editor with an AI assistant that streams suggestions, explanations, and code generation.

## Frontend Architecture

```
React App
├── Monaco Editor (code editing)
├── FileExplorer (virtual file tree)
├── AIAssistant (streaming chat sidebar)
├── Terminal (xterm.js + WebSocket)
└── Toolbar (AI action buttons)
```

### Monaco Editor Integration
- `@monaco-editor/react` wraps Monaco
- AI completions registered via `monaco.languages.registerInlineCompletionsProvider`
- Real-time diagnostics from backend LSP bridge

### Terminal
- xterm.js renders the terminal UI
- WebSocket `/ws/terminal` connects to backend subprocess
- Input/output piped via WebSocket messages

## Backend Architecture

### AI Module
- `CodeAssistant`: streaming completions via OpenAI/Anthropic
- `CodeExplainer`: selected-code explanation
- `Generator`: spec-to-code (full file generation)
- `Debugger`: error + stacktrace → fix suggestion

### IDE Module
- `FileSystem`: safe file read/write with path validation
- `ProjectIndexer`: creates vector embeddings of project files
- `TerminalRunner`: subprocess management with allowlist
- `LSPBridge`: language server protocol relay (optional)

## Streaming Architecture

All AI responses stream via:
1. FastAPI `StreamingResponse` for HTTP endpoints
2. WebSocket for terminal and real-time completions

## Security

- File system operations restricted to `WORKSPACE_DIR`
- Terminal allowlist enforced: only approved commands run
- No arbitrary code execution outside sandbox
