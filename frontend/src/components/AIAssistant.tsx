import React, { useState, useRef, useCallback, useEffect, useContext } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Send, Copy, Check, Zap, Bug, Code2, Wand2, X, ChevronDown } from "lucide-react";
import { AppContext } from "../App";
import clsx from "clsx";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type AIAction = "chat" | "explain" | "debug" | "generate";

interface ActionButton {
  action: AIAction;
  label: string;
  icon: React.ReactNode;
  endpoint: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  { action: "explain", label: "Explain", icon: <Code2 size={14} />, endpoint: "/api/v1/ai/explain" },
  { action: "debug", label: "Debug", icon: <Bug size={14} />, endpoint: "/api/v1/ai/debug" },
  { action: "generate", label: "Generate", icon: <Wand2 size={14} />, endpoint: "/api/v1/ai/generate" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function ApplyButton({ code, onApply }: { code: string; onApply: (code: string) => void }) {
  return (
    <button
      onClick={() => onApply(code)}
      className="px-2 py-0.5 text-xs rounded bg-editor-accent hover:bg-editor-accentHover text-white transition-colors"
    >
      Apply to Editor
    </button>
  );
}

function MarkdownContent({ content, onApply }: { content: string; onApply: (code: string) => void }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const codeStr = String(children).replace(/\n$/, "");
          const isBlock = !!match;

          if (!isBlock) {
            return <code className="bg-black/30 rounded px-1 text-xs font-mono text-editor-info" {...props}>{children}</code>;
          }

          return (
            <div className="my-2 rounded overflow-hidden border border-editor-border">
              <div className="flex items-center justify-between px-3 py-1 bg-black/30 text-xs text-editor-muted">
                <span>{match[1]}</span>
                <div className="flex items-center gap-2">
                  <CopyButton text={codeStr} />
                  <ApplyButton code={codeStr} onApply={onApply} />
                </div>
              </div>
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                customStyle={{ margin: 0, fontSize: "12px", background: "rgba(0,0,0,0.4)" }}
              >
                {codeStr}
              </SyntaxHighlighter>
            </div>
          );
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-editor-text">{children}</li>,
        h3: ({ children }) => <h3 className="font-semibold text-editor-info mt-3 mb-1">{children}</h3>,
        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-editor-accent pl-3 text-editor-muted italic my-2">{children}</blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function AIAssistant({ selectedCode, language }: {
  selectedCode: string;
  language: string;
}) {
  const ctx = useContext(AppContext)!;
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! I'm **CodeForge AI**. I can help you:\n\n- Explain or review your code\n- Debug errors\n- Generate code from descriptions\n- Answer coding questions\n\nSelect code in the editor and click an action, or just ask me anything!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<AIAction>("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const applyToEditor = useCallback((code: string) => {
    if (!ctx.activeTab) return;
    ctx.updateTabContent(ctx.activeTab, code);
  }, [ctx]);

  const addMessage = useCallback((role: "user" | "assistant", content: string, id?: string): string => {
    const msgId = id ?? Date.now().toString();
    setMessages((prev) => [...prev, { id: msgId, role, content }]);
    return msgId;
  }, []);

  const streamResponse = useCallback(async (endpoint: string, body: object, userMsgId: string) => {
    const aiMsgId = `ai-${Date.now()}`;
    setMessages((prev) => [...prev, { id: aiMsgId, role: "assistant", content: "", isStreaming: true }]);
    setIsLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const finalAcc = accumulated;
        setMessages((prev) =>
          prev.map((m) => m.id === aiMsgId ? { ...m, content: finalAcc } : m)
        );
      }

      setMessages((prev) =>
        prev.map((m) => m.id === aiMsgId ? { ...m, isStreaming: false } : m)
      );
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? { ...m, content: `Error: ${err.message}`, isStreaming: false }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userContent = input.trim();
    setInput("");

    const userMsgId = addMessage("user", userContent);
    const currentMessages = messages
      .filter((m) => !m.isStreaming)
      .map((m) => ({ role: m.role, content: m.content }));

    await streamResponse("/api/v1/ai/chat", {
      messages: [...currentMessages, { role: "user", content: userContent }],
      selected_code: selectedCode || undefined,
      language: language || undefined,
    }, userMsgId);
  }, [input, isLoading, messages, selectedCode, language, addMessage, streamResponse]);

  const handleAction = useCallback(async (action: ActionButton) => {
    if (!selectedCode || isLoading) return;
    const userMsgId = addMessage("user", `[${action.label}] selected ${language} code`);

    const bodies: Record<string, object> = {
      explain: { code: selectedCode, language },
      debug: { error: "Analyze this code for bugs", code: selectedCode, language },
      generate: { spec: selectedCode, language, context: "" },
    };

    await streamResponse(action.endpoint, bodies[action.action] ?? {}, userMsgId);
  }, [selectedCode, language, isLoading, addMessage, streamResponse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-editor-sidebar border-l border-editor-border">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-editor-border bg-editor-toolbar">
        <Zap size={14} className="text-editor-accent" />
        <span className="text-sm font-medium text-editor-text">AI Assistant</span>
        <span className="ml-auto text-xs text-editor-muted">CodeForge AI</span>
      </div>

      {/* Action buttons (context-sensitive) */}
      {selectedCode && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-editor-border bg-black/20">
          <span className="text-xs text-editor-muted self-center mr-1">Selection:</span>
          {ACTION_BUTTONS.map((ab) => (
            <button
              key={ab.action}
              onClick={() => handleAction(ab)}
              disabled={isLoading}
              className={clsx(
                "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                "bg-editor-active hover:bg-editor-accent hover:text-white text-editor-text",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {ab.icon}
              {ab.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={clsx("chat-message", msg.role === "user" ? "chat-message-user" : "chat-message-ai")}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-semibold text-editor-muted">
                {msg.role === "user" ? "You" : "CodeForge AI"}
              </span>
            </div>
            {msg.isStreaming && !msg.content ? (
              <div className="ai-thinking">
                <span /><span /><span />
              </div>
            ) : (
              <div className="text-sm text-editor-text">
                <MarkdownContent content={msg.content} onApply={applyToEditor} />
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-editor-border p-2">
        <div className="flex flex-col gap-1">
          {selectedCode && (
            <div className="text-xs text-editor-muted px-1 truncate">
              Context: {selectedCode.slice(0, 60)}{selectedCode.length > 60 ? "..." : ""}
            </div>
          )}
          <div className="flex gap-1.5">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Shift+Enter for newline)"
              disabled={isLoading}
              rows={2}
              className={clsx(
                "flex-1 resize-none rounded px-2 py-1.5 text-sm",
                "bg-editor-active border border-editor-border text-editor-text",
                "placeholder-editor-muted focus:outline-none focus:border-editor-accent",
                "disabled:opacity-50"
              )}
            />
            {isLoading ? (
              <button onClick={stopGeneration} className="px-2 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs self-end">
                <X size={14} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="px-2 py-1 rounded bg-editor-accent hover:bg-editor-accentHover text-white self-end disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
