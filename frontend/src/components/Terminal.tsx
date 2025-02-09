import React, { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { Sparkles, X, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import clsx from "clsx";
import "xterm/css/xterm.css";

const WS_BASE = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000";
const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface TerminalProps {
  onClose?: () => void;
}

export default function Terminal({ onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [nlInput, setNLInput] = useState("");
  const [nlLoading, setNLLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputBuffer, setInputBuffer] = useState("");
  const [wsConnected, setWsConnected] = useState(false);

  const connectWS = useCallback(() => {
    const ws = new WebSocket(`${WS_BASE}/ws/terminal`);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      xtermRef.current?.writeln("\x1b[32mTerminal connected.\x1b[0m Type commands below.");
      xtermRef.current?.write("\x1b[33m$ \x1b[0m");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const term = xtermRef.current;
      if (!term) return;

      if (data.type === "output") {
        term.write(data.data.replace(/\n/g, "\r\n"));
      } else if (data.type === "error") {
        term.writeln(`\x1b[31m${data.data}\x1b[0m`);
      } else if (data.type === "done") {
        term.write("\x1b[33m$ \x1b[0m");
        setInputBuffer("");
      } else if (data.type === "start") {
        term.writeln(`\x1b[36mRunning: ${data.command}\x1b[0m`);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      xtermRef.current?.writeln("\x1b[31mDisconnected. Reconnecting...\x1b[0m");
      setTimeout(connectWS, 3000);
    };

    ws.onerror = () => {
      xtermRef.current?.writeln("\x1b[31mWebSocket error.\x1b[0m");
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      theme: {
        background: "#0d0d0d",
        foreground: "#d4d4d4",
        cursor: "#007acc",
        cursorAccent: "#1e1e1e",
        selectionBackground: "#264f78",
        black: "#1e1e1e", red: "#f44747", green: "#4ec9b0",
        yellow: "#dcdcaa", blue: "#569cd6", magenta: "#c586c0",
        cyan: "#9cdcfe", white: "#d4d4d4",
        brightBlack: "#808080", brightRed: "#f44747", brightGreen: "#6a9955",
        brightYellow: "#d7ba7d", brightBlue: "#264f78", brightMagenta: "#b267e6",
        brightCyan: "#4fc1ff", brightWhite: "#ffffff",
      },
      fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 1000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const linksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(linksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitRef.current = fitAddon;

    connectWS();

    // Handle keyboard input
    term.onKey(({ key, domEvent }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      if (domEvent.key === "Enter") {
        const cmd = inputBuffer.trim();
        setInputBuffer("");
        term.writeln("");
        if (cmd) {
          ws.send(JSON.stringify({ command: cmd }));
        } else {
          term.write("\x1b[33m$ \x1b[0m");
        }
      } else if (domEvent.key === "Backspace") {
        setInputBuffer((prev) => {
          if (prev.length > 0) {
            term.write("\b \b");
            return prev.slice(0, -1);
          }
          return prev;
        });
      } else if (key.length === 1 && !domEvent.ctrlKey && !domEvent.altKey) {
        setInputBuffer((prev) => prev + key);
        term.write(key);
      }
    });

    const observer = new ResizeObserver(() => { fitAddon.fit(); });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      term.dispose();
      ws?.close();
    };
  }, []);

  const handleNLSubmit = useCallback(async () => {
    if (!nlInput.trim() || nlLoading) return;
    const query = nlInput.trim();
    setNLInput("");
    setNLLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/terminal/nl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      const term = xtermRef.current;
      if (term && data.command) {
        term.writeln(`\x1b[35mAI Suggestion: \x1b[36m${data.command}\x1b[0m`);
        if (data.explanation) {
          term.writeln(`\x1b[2m# ${data.explanation}\x1b[0m`);
        }
        // Pre-fill the input buffer
        setInputBuffer(data.command);
        term.write(`\x1b[33m$ \x1b[0m${data.command}`);
      }
    } catch {
      xtermRef.current?.writeln("\x1b[31mFailed to get AI command suggestion.\x1b[0m");
    } finally {
      setNLLoading(false);
    }
  }, [nlInput, nlLoading]);

  return (
    <div className={clsx("flex flex-col bg-[#0d0d0d] border-t border-editor-border", isMaximized ? "fixed inset-0 z-50" : "h-full")}>
      {/* Terminal toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-editor-toolbar border-b border-editor-border flex-shrink-0">
        <span className="text-xs font-semibold text-editor-muted uppercase tracking-wider">Terminal</span>
        <div className={clsx("w-2 h-2 rounded-full ml-1", wsConnected ? "bg-green-500" : "bg-red-500")} title={wsConnected ? "Connected" : "Disconnected"} />

        {/* NL input */}
        <div className="flex items-center gap-1 ml-4 flex-1 max-w-sm">
          <Sparkles size={12} className="text-editor-accent flex-shrink-0" />
          <input
            value={nlInput}
            onChange={(e) => setNLInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleNLSubmit()}
            placeholder="Describe what to run..."
            className={clsx(
              "flex-1 text-xs bg-editor-active border border-editor-border rounded px-2 py-0.5",
              "text-editor-text placeholder-editor-muted focus:outline-none focus:border-editor-accent",
              nlLoading && "opacity-50"
            )}
          />
          <button
            onClick={handleNLSubmit}
            disabled={nlLoading || !nlInput.trim()}
            className="text-xs px-2 py-0.5 rounded bg-editor-accent hover:bg-editor-accentHover text-white disabled:opacity-40 transition-colors"
          >
            {nlLoading ? "..." : "Ask AI"}
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => { xtermRef.current?.clear(); }}
            className="p-1 rounded hover:bg-editor-hover text-editor-muted hover:text-editor-text transition-colors"
            title="Clear"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={() => setIsMaximized((v) => !v)}
            className="p-1 rounded hover:bg-editor-hover text-editor-muted hover:text-editor-text transition-colors"
            title={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-editor-hover text-editor-muted hover:text-editor-text transition-colors" title="Close">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* xterm container */}
      <div ref={containerRef} className="flex-1 overflow-hidden p-1" />
    </div>
  );
}
