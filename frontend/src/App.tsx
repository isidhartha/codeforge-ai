import React, { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import IDE from "./pages/IDE";
import Dashboard from "./pages/Dashboard";

export interface FileTab {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface AppState {
  tabs: FileTab[];
  activeTab: string | null;
  terminalOpen: boolean;
  aiPanelOpen: boolean;
  fileExplorerOpen: boolean;
}

export interface AppActions {
  openFile: (path: string, name: string, content: string, language: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  toggleTerminal: () => void;
  toggleAIPanel: () => void;
  toggleFileExplorer: () => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  ".py": "python", ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".json": "json",
  ".html": "html", ".css": "css", ".scss": "scss",
  ".go": "go", ".rs": "rust", ".java": "java",
  ".cpp": "cpp", ".c": "c", ".h": "c",
  ".md": "markdown", ".yaml": "yaml", ".yml": "yaml",
  ".sh": "shell", ".bash": "shell", ".sql": "sql",
  ".xml": "xml", ".toml": "toml",
};

export function detectLanguage(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf("."));
  return LANGUAGE_MAP[ext] ?? "plaintext";
}

export const AppContext = React.createContext<(AppState & AppActions) | null>(null);

export default function App() {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTab, setActiveTabState] = useState<string | null>(null);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [aiPanelOpen, setAIPanelOpen] = useState(true);
  const [fileExplorerOpen, setFileExplorerOpen] = useState(true);

  const openFile = useCallback((path: string, name: string, content: string, language: string) => {
    setTabs((prev) => {
      if (prev.find((t) => t.path === path)) return prev;
      return [...prev, { path, name, content, language, isDirty: false }];
    });
    setActiveTabState(path);
  }, []);

  const closeTab = useCallback((path: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.path !== path);
      return filtered;
    });
    setActiveTabState((prev) => {
      if (prev !== path) return prev;
      const remaining = tabs.filter((t) => t.path !== path);
      return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
    });
  }, [tabs]);

  const setActiveTab = useCallback((path: string) => setActiveTabState(path), []);

  const updateTabContent = useCallback((path: string, content: string) => {
    setTabs((prev) =>
      prev.map((t) => t.path === path ? { ...t, content, isDirty: true } : t)
    );
  }, []);

  const ctx: AppState & AppActions = {
    tabs, activeTab, terminalOpen, aiPanelOpen, fileExplorerOpen,
    openFile, closeTab, setActiveTab, updateTabContent,
    toggleTerminal: () => setTerminalOpen((v) => !v),
    toggleAIPanel: () => setAIPanelOpen((v) => !v),
    toggleFileExplorer: () => setFileExplorerOpen((v) => !v),
  };

  return (
    <AppContext.Provider value={ctx}>
      <Routes>
        <Route path="/" element={<Navigate to="/ide" replace />} />
        <Route path="/ide" element={<IDE />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </AppContext.Provider>
  );
}
