import React, { useRef, useCallback, useContext, useEffect } from "react";
import Editor, { OnMount, BeforeMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { AppContext } from "../App";

interface MonacoEditorProps {
  path: string;
  content: string;
  language: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selected: string) => void;
}

const AI_COMPLETE_URL = "/api/v1/ai/complete";

export default function MonacoEditor({
  path, content, language, onChange, onSelectionChange,
}: MonacoEditorProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const completionDisposable = useRef<monaco.IDisposable | null>(null);

  const beforeMount: BeforeMount = (monacoInstance) => {
    // Custom dark theme matching VS Code
    monacoInstance.editor.defineTheme("codeforge-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "type", foreground: "4EC9B0" },
        { token: "function", foreground: "DCDCAA" },
        { token: "variable", foreground: "9CDCFE" },
        { token: "operator", foreground: "D4D4D4" },
      ],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#D4D4D4",
        "editorLineNumber.foreground": "#858585",
        "editorCursor.foreground": "#AEAFAD",
        "editor.selectionBackground": "#264F78",
        "editor.inactiveSelectionBackground": "#3A3D41",
        "editorIndentGuide.background": "#404040",
        "editorWidget.background": "#252526",
        "editorSuggestWidget.border": "#007ACC",
        "editorSuggestWidget.selectedBackground": "#062F4A",
        "list.hoverBackground": "#2A2D2E",
        "list.activeSelectionBackground": "#094771",
      },
    });
  };

  const registerAICompletionProvider = useCallback(
    (monacoInstance: typeof monaco) => {
      completionDisposable.current?.dispose();
      completionDisposable.current = monacoInstance.languages.registerCompletionItemProvider(
        { pattern: "**" } as any,
        {
          triggerCharacters: [".", " ", "(", "{"],
          provideCompletionItems: async (model, position) => {
            const offset = model.getOffsetAt(position);
            const code = model.getValue();
            const lang = model.getLanguageId();

            try {
              const response = await fetch(AI_COMPLETE_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code, language: lang, cursor_position: offset, file_path: path }),
              });

              if (!response.ok || !response.body) return { suggestions: [] };
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let suggestion = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                suggestion += decoder.decode(value, { stream: true });
              }

              if (!suggestion.trim()) return { suggestions: [] };

              const word = model.getWordUntilPosition(position);
              const range = new monacoInstance.Range(
                position.lineNumber, word.startColumn,
                position.lineNumber, word.endColumn
              );

              return {
                suggestions: [{
                  label: { label: "AI Completion", description: suggestion.slice(0, 60) },
                  kind: monacoInstance.languages.CompletionItemKind.Text,
                  insertText: suggestion,
                  range,
                  detail: "CodeForge AI",
                  documentation: { value: `\`\`\`${lang}\n${suggestion}\n\`\`\`` },
                  sortText: "0000",
                }],
              };
            } catch {
              return { suggestions: [] };
            }
          },
        }
      );
    },
    [path]
  );

  const onMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor;

    // Register AI completion provider
    registerAICompletionProvider(monacoInstance);

    // Selection change → send to AI sidebar
    editor.onDidChangeCursorSelection((e) => {
      if (!onSelectionChange) return;
      const selection = editor.getModel()?.getValueInRange(e.selection) ?? "";
      onSelectionChange(selection);
    });

    // Format on save (Ctrl+S)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      editor.getAction("editor.action.formatDocument")?.run();
    });

    // Trigger AI completion on Ctrl+Space (already default, but reinforce)
    editor.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Space,
      () => editor.trigger("keyboard", "editor.action.triggerSuggest", {}),
    );

    // Focus
    editor.focus();
  };

  useEffect(() => {
    return () => { completionDisposable.current?.dispose(); };
  }, []);

  return (
    <Editor
      height="100%"
      path={path}
      defaultLanguage={language}
      language={language}
      value={content}
      theme="codeforge-dark"
      beforeMount={beforeMount}
      onMount={onMount}
      onChange={(val) => onChange(val ?? "")}
      options={{
        fontSize: 14,
        fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
        fontLigatures: true,
        lineNumbers: "on",
        minimap: { enabled: true, scale: 1 },
        scrollBeyondLastLine: false,
        wordWrap: "on",
        automaticLayout: true,
        tabSize: 2,
        insertSpaces: true,
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        suggest: { showIcons: true, showStatusBar: true },
        quickSuggestions: { other: true, comments: false, strings: false },
        inlayHints: { enabled: "on" },
        renderLineHighlight: "gutter",
        smoothScrolling: true,
        cursorBlinking: "smooth",
        cursorSmoothCaretAnimation: "on",
        padding: { top: 8, bottom: 8 },
        scrollbar: { vertical: "visible", horizontal: "visible", verticalScrollbarSize: 8 },
        overviewRulerLanes: 3,
        codeLens: true,
        colorDecorators: true,
        formatOnPaste: true,
        formatOnType: false,
      }}
    />
  );
}
