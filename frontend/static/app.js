const API = 'http://localhost:8000';
let editor = null;
let openFiles = {};
let activeFile = null;
let termWs = null;
let aiWs = null;
let termHistory = [];
let termHistIdx = -1;
let activeTerm = 1;
let isDark = true;

// ---- MONACO INIT ----
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
require(['vs/editor/editor.main'], function() {
  editor = monaco.editor.create(document.getElementById('editorContainer'), {
    value: '// Welcome to CodeForge AI\n// Open a file from the explorer, or create a new one.\n\n',
    language: 'python',
    theme: 'vs-dark',
    fontSize: 13,
    fontFamily: '"JetBrains Mono", monospace',
    fontLigatures: true,
    minimap: { enabled: true },
    lineNumbers: 'on',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    padding: { top: 8 }
  });

  editor.onDidChangeCursorPosition(e => {
    document.getElementById('cursorPos').textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
  });

  // Ctrl+S → save
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveFile);

  // Context menu
  editor.addAction({
    id: 'explain', label: 'Explain Selection', keybindings: [],
    run: () => triggerAI('explain')
  });
  editor.addAction({
    id: 'debug_sel', label: 'Debug This Code', keybindings: [],
    run: () => triggerAI('debug')
  });
  editor.addAction({
    id: 'gen_tests', label: 'Generate Tests', keybindings: [],
    run: () => { document.getElementById('aiInput').value = 'Generate unit tests for the selected code'; sendAIChat(); }
  });

  loadFileTree();
  checkHealth();
  connectTermWS();
  connectAIWS();
});

// ---- HEALTH ----
async function checkHealth() {
  try {
    const r = await fetch(`${API}/health`);
    document.getElementById('backendStatus').innerHTML = r.ok ? '<span style="color:#10b981">● online</span>' : '<span style="color:#ef4444">● offline</span>';
  } catch { document.getElementById('backendStatus').innerHTML = '<span style="color:#ef4444">● offline</span>'; }
}

// ---- FILE TREE ----
async function loadFileTree() {
  const container = document.getElementById('fileTree');
  try {
    const r = await fetch(`${API}/api/v1/files?path=/`);
    if (!r.ok) throw new Error();
    const files = await r.json();
    renderFileTree(container, Array.isArray(files) ? files : files.files || files.items || [], 0);
  } catch { renderMockFileTree(container); }
}

function renderMockFileTree(container) {
  const mockFiles = [
    { name: 'main.py', path: '/main.py', type: 'file' },
    { name: 'utils', path: '/utils', type: 'dir', children: [
      { name: 'helpers.py', path: '/utils/helpers.py', type: 'file' },
      { name: 'config.py', path: '/utils/config.py', type: 'file' },
    ]},
    { name: 'requirements.txt', path: '/requirements.txt', type: 'file' },
    { name: 'README.md', path: '/README.md', type: 'file' },
  ];
  renderFileTree(container, mockFiles, 0);
}

function renderFileTree(container, files, depth) {
  container.innerHTML = '';
  files.forEach(f => {
    const item = document.createElement('div');
    item.style.paddingLeft = (depth * 12 + 8) + 'px';
    if (f.type === 'dir' || f.is_dir) {
      item.className = 'file-tree-item folder-item';
      item.innerHTML = `<i class="fas fa-chevron-right text-xs" style="width:12px;transition:transform 0.15s"></i><i class="fas fa-folder" style="color:#e8a317"></i><span>${f.name}</span>`;
      item.onclick = () => toggleFolder(item, f, depth);
    } else {
      item.className = 'file-tree-item';
      item.innerHTML = `<i style="width:12px"></i>${fileIcon(f.name)}<span>${f.name}</span>`;
      item.onclick = () => openFile(f);
    }
    container.appendChild(item);
  });
}

function toggleFolder(item, folder, depth) {
  const chevron = item.querySelector('.fa-chevron-right');
  const nextEl = item.nextElementSibling;
  if (nextEl && nextEl.classList.contains('folder-children')) {
    nextEl.remove();
    chevron.style.transform = '';
  } else {
    chevron.style.transform = 'rotate(90deg)';
    const children = document.createElement('div');
    children.className = 'folder-children';
    // Load children
    fetch(`${API}/api/v1/files?path=${folder.path}`).then(r => r.ok ? r.json() : []).then(data => {
      const files = Array.isArray(data) ? data : data.files || [];
      files.forEach(f => {
        const child = document.createElement('div');
        child.style.paddingLeft = ((depth + 1) * 12 + 8) + 'px';
        if (f.type === 'dir' || f.is_dir) {
          child.className = 'file-tree-item folder-item';
          child.innerHTML = `<i class="fas fa-chevron-right text-xs" style="width:12px"></i><i class="fas fa-folder" style="color:#e8a317"></i><span>${f.name}</span>`;
          child.onclick = () => toggleFolder(child, f, depth + 1);
        } else {
          child.className = 'file-tree-item';
          child.innerHTML = `<i style="width:12px"></i>${fileIcon(f.name)}<span>${f.name}</span>`;
          child.onclick = () => openFile(f);
        }
        children.appendChild(child);
      });
    }).catch(() => {});
    item.after(children);
  }
}

function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = { py:'<i class="fab fa-python fi-py"></i>', js:'<i class="fab fa-js fi-js"></i>', ts:'<i class="fab fa-js fi-ts"></i>', json:'<i class="fas fa-brackets-curly fi-json"></i>', md:'<i class="fab fa-markdown fi-md"></i>', html:'<i class="fab fa-html5 fi-html"></i>', css:'<i class="fab fa-css3 fi-css"></i>' };
  return map[ext] || '<i class="fas fa-file fi-default"></i>';
}

// ---- OPEN FILE ----
async function openFile(file) {
  if (openFiles[file.path]) {
    switchToFile(file.path);
    return;
  }
  try {
    const r = await fetch(`${API}/api/v1/files/${encodeURIComponent(file.path.replace(/^\//, ''))}`);
    if (!r.ok) throw new Error();
    const data = await r.json();
    const content = data.content || data.text || data;
    openFiles[file.path] = { name: file.name, content: typeof content === 'string' ? content : JSON.stringify(content, null, 2) };
    addEditorTab(file.path, file.name);
    switchToFile(file.path);
  } catch {
    openFiles[file.path] = { name: file.name, content: `// Could not load file: ${file.path}\n// Make sure the backend is running.\n` };
    addEditorTab(file.path, file.name);
    switchToFile(file.path);
  }
}

function addEditorTab(path, name) {
  const tabs = document.getElementById('editorTabs');
  const existing = tabs.querySelector('.text-slate-600');
  if (existing) existing.remove();
  const tab = document.createElement('div');
  tab.className = 'editor-tab';
  tab.id = 'tab-' + btoa(path).replace(/=/g,'');
  tab.innerHTML = `${fileIcon(name)}<span>${name}</span><button class="close-btn text-muted hover:text-red-400 ml-1 text-xs" onclick="closeTab('${path}',event)"><i class="fas fa-times"></i></button>`;
  tab.onclick = () => switchToFile(path);
  tabs.appendChild(tab);
}

function switchToFile(path) {
  activeFile = path;
  document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('tab-' + btoa(path).replace(/=/g,''));
  if (tab) tab.classList.add('active');
  if (editor && openFiles[path]) {
    const content = openFiles[path].content;
    editor.setValue(content);
    const lang = detectLanguage(openFiles[path].name);
    monaco.editor.setModelLanguage(editor.getModel(), lang);
    document.getElementById('languageMode').textContent = lang.charAt(0).toUpperCase() + lang.slice(1);
    document.getElementById('filePath').textContent = path;
  }
  // Highlight in tree
  document.querySelectorAll('.file-tree-item').forEach(item => {
    item.classList.toggle('active', item.querySelector('span')?.textContent === openFiles[path]?.name);
  });
}

function closeTab(path, e) {
  e.stopPropagation();
  delete openFiles[path];
  const tab = document.getElementById('tab-' + btoa(path).replace(/=/g,''));
  if (tab) tab.remove();
  const remaining = Object.keys(openFiles);
  if (remaining.length > 0) switchToFile(remaining[remaining.length - 1]);
  else { activeFile = null; if (editor) editor.setValue('// No file open\n'); }
}

function detectLanguage(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  const map = { py: 'python', js: 'javascript', ts: 'typescript', json: 'json', md: 'markdown', html: 'html', css: 'css', sh: 'shell', bash: 'shell', go: 'go', rs: 'rust', java: 'java', cpp: 'cpp', c: 'c' };
  return map[ext] || 'plaintext';
}

// ---- SAVE ----
async function saveFile() {
  if (!activeFile || !editor) return;
  const content = editor.getValue();
  if (openFiles[activeFile]) openFiles[activeFile].content = content;
  try {
    const path = activeFile.replace(/^\//, '');
    await fetch(`${API}/api/v1/files/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    termLog('Saved: ' + activeFile, 'system');
  } catch { termLog('Save failed (backend offline)', 'stderr'); }
}

// ---- RUN ----
async function runCurrentFile() {
  await saveFile();
  if (!activeFile) return showToast('No file open', 'error');
  const ext = activeFile.split('.').pop().toLowerCase();
  const cmdMap = { py: `python ${activeFile}`, js: `node ${activeFile}`, ts: `ts-node ${activeFile}`, sh: `bash ${activeFile}` };
  const cmd = cmdMap[ext] || `cat ${activeFile}`;
  termLog('$ ' + cmd, 'prompt');
  if (termWs && termWs.readyState === WebSocket.OPEN) {
    termWs.send(JSON.stringify({ command: cmd }));
  } else {
    await runCommand(cmd);
  }
}

async function runCommand(cmd) {
  try {
    const r = await fetch(`${API}/api/v1/terminal/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (data.output) data.output.split('\n').forEach(line => termLog(line, 'stdout'));
    if (data.exit_code !== 0 && data.exit_code !== undefined) termLog(`Exit: ${data.exit_code}`, 'stderr');
  } catch (e) { termLog('Run failed: ' + e.message, 'stderr'); }
}

// ---- TERMINAL ----
function connectTermWS() {
  try {
    termWs = new WebSocket('ws://localhost:8000/ws/terminal');
    termWs.onopen = () => termLog('Terminal connected', 'system');
    termWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') termLog(msg.data || msg.output || '', 'stdout');
        else if (msg.type === 'error') termLog(msg.data || '', 'stderr');
        else if (msg.type === 'done') termLog('Process exited ' + (msg.exit_code || 0), 'system');
      } catch { termLog(e.data, 'stdout'); }
    };
    termWs.onclose = () => { termLog('Terminal disconnected. Reconnecting…', 'system'); setTimeout(connectTermWS, 5000); };
    termWs.onerror = () => {};
  } catch {}
}

function handleTerminalKey(e) {
  const input = document.getElementById('termInput');
  if (e.key === 'Enter') {
    const cmd = input.value;
    input.value = '';
    termHistIdx = -1;
    if (!cmd) return;
    termHistory.unshift(cmd);
    termLog('$ ' + cmd, 'prompt');
    if (cmd.startsWith('?')) {
      nlToCommand(cmd.slice(1).trim());
    } else if (termWs && termWs.readyState === WebSocket.OPEN) {
      termWs.send(JSON.stringify({ type: 'start', command: cmd }));
    } else {
      runCommand(cmd);
    }
  } else if (e.key === 'ArrowUp') {
    termHistIdx = Math.min(termHistIdx + 1, termHistory.length - 1);
    input.value = termHistory[termHistIdx] || '';
  } else if (e.key === 'ArrowDown') {
    termHistIdx = Math.max(termHistIdx - 1, -1);
    input.value = termHistIdx >= 0 ? termHistory[termHistIdx] : '';
  }
}

async function nlToCommand(description) {
  termLog(`? Converting: "${description}"`, 'system');
  try {
    const r = await fetch(`${API}/api/v1/terminal/nl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    });
    if (!r.ok) throw new Error();
    const data = await r.json();
    const cmd = data.command || data.result;
    termLog(`→ ${cmd}`, 'system');
    document.getElementById('termInput').value = cmd;
  } catch { termLog('NL conversion failed', 'stderr'); }
}

function termLog(text, type = 'stdout') {
  const out = document.getElementById('terminalOutput');
  const line = document.createElement('div');
  line.className = type;
  line.textContent = text;
  out.appendChild(line);
  out.scrollTop = out.scrollHeight;
}

function toggleTerminal() {
  const panel = document.getElementById('terminalPanel');
  panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  if (panel.style.display !== 'none' && editor) editor.layout();
}

function addTerminal() { /* future: multiple terminals */ showToast('Multiple terminals coming soon', 'info'); }
function switchTerm(n) { activeTerm = n; document.querySelectorAll('.term-tab').forEach(t => t.classList.remove('active')); document.getElementById('term-tab-' + n)?.classList.add('active'); }

// ---- AI ASSISTANT ----
function connectAIWS() {
  try {
    aiWs = new WebSocket('ws://localhost:8000/ws/ai-stream');
    aiWs.onopen = () => {};
    aiWs.onclose = () => setTimeout(connectAIWS, 5000);
    aiWs.onerror = () => {};
  } catch {}
}

function toggleAI() {
  const panel = document.getElementById('aiPanel');
  const btn = document.getElementById('actAI');
  panel.classList.toggle('hidden');
  btn.classList.toggle('active', !panel.classList.contains('hidden'));
  if (editor) editor.layout();
}

function toggleFileTree() {
  const sidebar = document.getElementById('fileSidebar');
  const btn = document.getElementById('actExplorer');
  sidebar.classList.toggle('hidden');
  btn.classList.toggle('active');
  if (editor) editor.layout();
}

function toggleSearch() {
  const explorer = document.getElementById('explorerPanel');
  const search = document.getElementById('searchPanel');
  const btn = document.getElementById('actSearch');
  if (!search.classList.contains('hidden')) {
    search.classList.add('hidden');
    explorer.classList.remove('hidden');
    btn.classList.remove('active');
  } else {
    explorer.classList.add('hidden');
    search.classList.remove('hidden');
    btn.classList.add('active');
    document.getElementById('searchInput').focus();
  }
}

async function searchProject(query) {
  if (!query || query.length < 2) return;
  const container = document.getElementById('searchResults');
  try {
    const r = await fetch(`${API}/api/v1/project/search`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 10 })
    });
    if (!r.ok) throw new Error();
    const results = await r.json();
    container.innerHTML = '';
    (results.results || results).slice(0, 10).forEach(res => {
      const item = document.createElement('div');
      item.className = 'file-tree-item';
      item.style.paddingLeft = '8px';
      item.innerHTML = `${fileIcon(res.path)}<span class="truncate">${res.path}</span>`;
      item.onclick = () => openFile({ name: res.path.split('/').pop(), path: res.path });
      container.appendChild(item);
    });
  } catch {}
}

async function triggerAI(action) {
  const aiPanel = document.getElementById('aiPanel');
  if (aiPanel.classList.contains('hidden')) toggleAI();

  let code = '';
  if (editor) {
    const selection = editor.getSelection();
    code = editor.getModel().getValueInRange(selection) || editor.getValue();
  }

  const language = activeFile ? detectLanguage(openFiles[activeFile]?.name || '') : 'python';
  const container = document.getElementById('aiMessages');
  const msgEl = document.createElement('div');
  msgEl.className = 'ai-msg-ai streaming-cursor mb-2';
  msgEl.textContent = '';
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;

  const actionLabels = { explain: 'Explain Code', debug: 'Debug', generate: 'Generate', complete: 'Complete', chat: 'Chat' };
  const labelEl = document.createElement('div');
  labelEl.className = 'ai-msg-user mb-2';
  labelEl.textContent = actionLabels[action] || action;
  container.insertBefore(labelEl, msgEl);

  const body = { code, language };
  if (action === 'debug') body.error = '';

  if (aiWs && aiWs.readyState === WebSocket.OPEN) {
    aiWs.send(JSON.stringify({ action, ...body }));
    let text = '';
    const origHandler = aiWs.onmessage;
    aiWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'chunk') { text += msg.content || ''; msgEl.textContent = text; container.scrollTop = container.scrollHeight; }
        else if (msg.type === 'done') { msgEl.classList.remove('streaming-cursor'); aiWs.onmessage = origHandler; }
        else if (msg.type === 'error') { msgEl.textContent = 'Error: ' + msg.message; msgEl.classList.remove('streaming-cursor'); aiWs.onmessage = origHandler; }
      } catch {}
    };
  } else {
    // Fallback REST
    try {
      const endpoints = { explain: 'explain', debug: 'debug', generate: 'generate', complete: 'complete', chat: 'chat' };
      const r = await fetch(`${API}/api/v1/ai/${endpoints[action]}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const reader = r.body?.getReader();
      let text = '';
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          msgEl.textContent = text;
        }
      } else {
        const data = await r.json();
        text = data.result || data.explanation || data.code || JSON.stringify(data);
        msgEl.textContent = text;
      }
      msgEl.classList.remove('streaming-cursor');
    } catch (e) {
      msgEl.textContent = `Error: ${e.message}`;
      msgEl.classList.remove('streaming-cursor');
    }
  }
}

async function sendAIChat() {
  const input = document.getElementById('aiInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const container = document.getElementById('aiMessages');
  const userEl = document.createElement('div');
  userEl.className = 'ai-msg-user mb-2';
  userEl.textContent = msg;
  container.appendChild(userEl);

  const aiEl = document.createElement('div');
  aiEl.className = 'ai-msg-ai streaming-cursor mb-2';
  aiEl.textContent = '';
  container.appendChild(aiEl);
  container.scrollTop = container.scrollHeight;

  const context = editor ? editor.getValue().substring(0, 2000) : '';

  if (aiWs && aiWs.readyState === WebSocket.OPEN) {
    aiWs.send(JSON.stringify({ action: 'chat', message: msg, context }));
    let text = '';
    const orig = aiWs.onmessage;
    aiWs.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.type === 'chunk') { text += m.content || ''; aiEl.textContent = text; container.scrollTop = container.scrollHeight; }
        else if (m.type === 'done') { aiEl.classList.remove('streaming-cursor'); aiWs.onmessage = orig; }
        else if (m.type === 'error') { aiEl.textContent = 'Error: ' + m.message; aiEl.classList.remove('streaming-cursor'); aiWs.onmessage = orig; }
      } catch {}
    };
  } else {
    try {
      const r = await fetch(`${API}/api/v1/ai/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context })
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      aiEl.textContent = data.result || data.response || JSON.stringify(data);
      aiEl.classList.remove('streaming-cursor');
    } catch (e) {
      aiEl.textContent = 'Error: ' + e.message;
      aiEl.classList.remove('streaming-cursor');
    }
  }
}

// ---- NEW FILE ----
function newFile() {
  document.getElementById('newFileModal').classList.remove('hidden');
  document.getElementById('newFileName').focus();
}
function closeNewFileModal() {
  document.getElementById('newFileModal').classList.add('hidden');
}
function createFile() {
  const name = document.getElementById('newFileName').value.trim();
  if (!name) return;
  closeNewFileModal();
  document.getElementById('newFileName').value = '';
  const path = '/' + name;
  openFiles[path] = { name, content: '' };
  addEditorTab(path, name);
  switchToFile(path);
}

// ---- THEME ----
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('light', !isDark);
  if (editor) monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
}

// ---- TOAST ----
function showToast(msg, type = 'info') { termLog('[' + type + '] ' + msg, type === 'error' ? 'stderr' : 'system'); }

// ---- INIT ----
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
});
