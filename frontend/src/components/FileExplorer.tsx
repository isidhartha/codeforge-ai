import React, { useEffect, useState, useCallback, useContext } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, RefreshCw } from "lucide-react";
import { AppContext, detectLanguage } from "../App";
import clsx from "clsx";

interface FileNode {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  extension: string;
  children?: FileNode[];
  expanded?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function fetchFiles(dirPath: string = ""): Promise<FileNode[]> {
  const url = `${API_BASE}/api/v1/files${dirPath ? `?path=${encodeURIComponent(dirPath)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  return res.json();
}

async function fetchFileContent(filePath: string): Promise<string> {
  const res = await fetch(`${API_BASE}/api/v1/files/${encodeURIComponent(filePath)}`);
  if (!res.ok) return "";
  const data = await res.json();
  return data.content ?? "";
}

function FileIcon({ extension, isDir, expanded }: { extension: string; isDir: boolean; expanded?: boolean }) {
  if (isDir) {
    return expanded
      ? <FolderOpen size={14} className="text-yellow-400 flex-shrink-0" />
      : <Folder size={14} className="text-yellow-400 flex-shrink-0" />;
  }
  const colorMap: Record<string, string> = {
    ".py": "text-blue-400", ".ts": "text-blue-300", ".tsx": "text-blue-300",
    ".js": "text-yellow-300", ".jsx": "text-yellow-300", ".json": "text-yellow-200",
    ".css": "text-purple-400", ".html": "text-orange-400", ".md": "text-gray-300",
    ".go": "text-cyan-400", ".rs": "text-orange-500", ".java": "text-red-400",
  };
  return <File size={14} className={clsx("flex-shrink-0", colorMap[extension] ?? "text-editor-muted")} />;
}

function TreeNode({
  node,
  depth,
  activeFile,
  onFileClick,
  onToggle,
}: {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  onFileClick: (node: FileNode) => void;
  onToggle: (path: string) => void;
}) {
  return (
    <div>
      <div
        className={clsx(
          "file-tree-item",
          !node.is_dir && activeFile === node.path && "active"
        )}
        style={{ paddingLeft: `${(depth + 1) * 12}px` }}
        onClick={() => node.is_dir ? onToggle(node.path) : onFileClick(node)}
      >
        {node.is_dir && (
          node.expanded
            ? <ChevronDown size={12} className="flex-shrink-0 text-editor-muted" />
            : <ChevronRight size={12} className="flex-shrink-0 text-editor-muted" />
        )}
        <FileIcon extension={node.extension} isDir={node.is_dir} expanded={node.expanded} />
        <span className="truncate text-editor-text">{node.name}</span>
        {!node.is_dir && node.size > 0 && (
          <span className="ml-auto text-xs text-editor-muted">
            {node.size < 1024 ? `${node.size}b` : `${(node.size / 1024).toFixed(1)}k`}
          </span>
        )}
      </div>
      {node.is_dir && node.expanded && node.children?.map((child) => (
        <TreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          activeFile={activeFile}
          onFileClick={onFileClick}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

export default function FileExplorer() {
  const ctx = useContext(AppContext)!;
  const [nodes, setNodes] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRoot = useCallback(async () => {
    setLoading(true);
    const files = await fetchFiles();
    setNodes(files);
    setLoading(false);
  }, []);

  useEffect(() => { loadRoot(); }, [loadRoot]);

  const handleFileClick = useCallback(async (node: FileNode) => {
    const existing = ctx.tabs.find((t) => t.path === node.path);
    if (existing) {
      ctx.setActiveTab(node.path);
      return;
    }
    const content = await fetchFileContent(node.path);
    ctx.openFile(node.path, node.name, content, detectLanguage(node.name));
  }, [ctx]);

  const handleToggle = useCallback(async (nodePath: string) => {
    const expand = async (nodes: FileNode[]): Promise<FileNode[]> => {
      return Promise.all(nodes.map(async (n) => {
        if (n.path !== nodePath) {
          if (n.children) return { ...n, children: await expand(n.children) };
          return n;
        }
        if (n.expanded) return { ...n, expanded: false };
        const children = await fetchFiles(n.path);
        return { ...n, expanded: true, children };
      }));
    };
    setNodes(await expand(nodes));
  }, [nodes]);

  return (
    <div className="flex flex-col h-full bg-editor-sidebar">
      <div className="flex items-center justify-between px-3 py-2 border-b border-editor-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-editor-muted">
          Explorer
        </span>
        <button onClick={loadRoot} className="p-1 rounded hover:bg-editor-hover transition-colors" title="Refresh">
          <RefreshCw size={13} className={clsx("text-editor-muted", loading && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading && nodes.length === 0 ? (
          <div className="px-4 py-3 text-xs text-editor-muted">Loading...</div>
        ) : nodes.length === 0 ? (
          <div className="px-4 py-3 text-xs text-editor-muted">
            Workspace is empty.<br />Files saved here will appear.
          </div>
        ) : (
          nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              activeFile={ctx.activeTab}
              onFileClick={handleFileClick}
              onToggle={handleToggle}
            />
          ))
        )}
      </div>
    </div>
  );
}
