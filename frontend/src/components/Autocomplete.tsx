import React, { useState, useCallback } from "react";
import { Zap, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import clsx from "clsx";

interface AutocompleteProps {
  code: string;
  language: string;
  cursorPosition: number;
  onInsert: (text: string) => void;
}

interface Suggestion {
  id: string;
  text: string;
  confidence: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export default function Autocomplete({ code, language, cursorPosition, onInsert }: AutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setSuggestions([]);

    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, cursor_position: cursorPosition }),
      });

      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      if (text.trim()) {
        setSuggestions([
          { id: "1", text: text, confidence: 0.92 },
        ]);
      }
    } catch (err) {
      console.error("Autocomplete error:", err);
    } finally {
      setLoading(false);
    }
  }, [code, language, cursorPosition]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="border-t border-editor-border bg-editor-sidebar">
      <div
        className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-editor-hover transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Zap size={13} className="text-editor-accent" />
        <span className="text-xs font-semibold text-editor-muted uppercase tracking-wider flex-1">
          AI Completions
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); fetchSuggestions(); }}
          disabled={loading}
          className={clsx(
            "text-xs px-2 py-0.5 rounded",
            "bg-editor-accent hover:bg-editor-accentHover text-white",
            "disabled:opacity-50 transition-colors"
          )}
        >
          {loading ? "Loading..." : "Suggest"}
        </button>
        {expanded ? <ChevronUp size={13} className="text-editor-muted" /> : <ChevronDown size={13} className="text-editor-muted" />}
      </div>

      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 py-2 px-1">
              <div className="ai-thinking"><span /><span /><span /></div>
              <span className="text-xs text-editor-muted">Generating completion...</span>
            </div>
          )}
          {!loading && suggestions.length === 0 && (
            <p className="text-xs text-editor-muted px-1 py-2">
              Click "Suggest" or press Ctrl+Space in the editor for AI completions.
            </p>
          )}
          {suggestions.map((s) => (
            <div key={s.id} className="rounded border border-editor-border overflow-hidden">
              <div className="flex items-center justify-between px-2 py-1 bg-black/30 text-xs text-editor-muted">
                <span className="text-green-400">{Math.round(s.confidence * 100)}% confidence</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => copyToClipboard(s.text, s.id)}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    {copiedId === s.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  </button>
                  <button
                    onClick={() => onInsert(s.text)}
                    className="px-2 py-0.5 rounded bg-editor-accent hover:bg-editor-accentHover text-white text-xs"
                  >
                    Insert
                  </button>
                </div>
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                customStyle={{ margin: 0, fontSize: "11px", background: "rgba(0,0,0,0.3)", maxHeight: "120px" }}
              >
                {s.text}
              </SyntaxHighlighter>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
