"""Index project files and provide semantic search using TF-IDF embeddings."""
import math
import re
from pathlib import Path
from typing import Optional
from collections import defaultdict
from shared.config import get_settings
from shared.logging import get_logger
from shared.models import SearchRequest, SearchResponse, SearchResult

logger = get_logger(__name__)
settings = get_settings()

_index: dict[str, list[tuple[str, int, int]]] = {}   # token -> [(file, line_start, line_end)]
_doc_store: dict[str, list[str]] = {}                  # file -> lines
_idf: dict[str, float] = {}
_indexed_dirs: set[str] = set()

CHUNK_LINES = 20
MIN_TOKEN_LEN = 3


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]+", text)
    return [t.lower() for t in tokens if len(t) >= MIN_TOKEN_LEN]


def _chunk_file(lines: list[str]) -> list[tuple[int, int, str]]:
    chunks = []
    for start in range(0, len(lines), CHUNK_LINES):
        end = min(start + CHUNK_LINES, len(lines))
        text = " ".join(lines[start:end])
        chunks.append((start, end, text))
    return chunks


def index_directory(directory: str, extensions: Optional[list[str]] = None) -> int:
    """Index all files in directory. Returns number of files indexed."""
    exts = set(extensions or [".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".java"])
    root = Path(directory)
    if not root.exists():
        raise FileNotFoundError(f"Directory not found: {directory}")

    file_count = 0
    doc_freq: dict[str, set[str]] = defaultdict(set)

    for fpath in root.rglob("*"):
        if not fpath.is_file() or fpath.suffix not in exts:
            continue
        if any(p in fpath.parts for p in {".git", "node_modules", "__pycache__", "dist"}):
            continue
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue

        rel = str(fpath.relative_to(root)).replace("\\", "/")
        _doc_store[rel] = lines

        for start, end, chunk_text in _chunk_file(lines):
            tokens = set(_tokenize(chunk_text))
            for token in tokens:
                _index.setdefault(token, []).append((rel, start, end))
                doc_freq[token].add(rel)

        file_count += 1

    total_docs = max(len(_doc_store), 1)
    for token, docs in doc_freq.items():
        _idf[token] = math.log((total_docs + 1) / (len(docs) + 1)) + 1.0

    _indexed_dirs.add(directory)
    logger.info("indexed_directory", directory=directory, files=file_count)
    return file_count


def search(req: SearchRequest) -> SearchResponse:
    """Perform TF-IDF semantic search across the index."""
    query_tokens = _tokenize(req.query)
    if not query_tokens:
        return SearchResponse(results=[], query=req.query, total=0)

    scores: dict[tuple[str, int, int], float] = defaultdict(float)

    for token in query_tokens:
        if token not in _index:
            continue
        idf = _idf.get(token, 1.0)
        for file_path, line_start, line_end in _index[token]:
            if req.directory and not file_path.startswith(req.directory.lstrip("/")):
                continue
            chunk_lines = _doc_store.get(file_path, [])[line_start:line_end]
            chunk_text = " ".join(chunk_lines)
            tf = _tokenize(chunk_text).count(token) / max(len(_tokenize(chunk_text)), 1)
            scores[(file_path, line_start, line_end)] += tf * idf

    sorted_hits = sorted(scores.items(), key=lambda x: x[1], reverse=True)[: req.limit]
    results = []
    for (file_path, line_start, line_end), score in sorted_hits:
        lines = _doc_store.get(file_path, [])[line_start:line_end]
        snippet = "\n".join(lines[:5])
        results.append(SearchResult(
            file_path=file_path,
            snippet=snippet,
            score=round(score, 4),
            line_start=line_start + 1,
            line_end=line_end,
        ))

    return SearchResponse(results=results, query=req.query, total=len(results))
