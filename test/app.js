// ── State ──────────────────────────────────────────────────────────────────
let config = { token: '', owner: '', repo: '', branch: 'main' };
let currentPath = [];

// ── Restore saved config from sessionStorage ───────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('gh_reader_config');
  if (saved) {
    const c = JSON.parse(saved);
    document.getElementById('ownerInput').value  = c.owner  || '';
    document.getElementById('repoInput').value   = c.repo   || '';
    document.getElementById('branchInput').value = c.branch || 'main';
    // Don't restore the token for security — user must re-enter each session
  }
});

// ── GitHub API helper ──────────────────────────────────────────────────────
async function ghFetch(endpoint) {
  const url = `https://api.github.com${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`GitHub API error ${res.status}: ${body.message || res.statusText}`);
  }

  return res.json();
}

// ── Load repo root ─────────────────────────────────────────────────────────
async function loadRepo() {
  config.token  = document.getElementById('tokenInput').value.trim();
  config.owner  = document.getElementById('ownerInput').value.trim();
  config.repo   = document.getElementById('repoInput').value.trim();
  config.branch = document.getElementById('branchInput').value.trim() || 'main';

  if (!config.token || !config.owner || !config.repo) {
    showError('Please fill in all fields including your PAT.');
    return;
  }

  // Save non-sensitive config
  sessionStorage.setItem('gh_reader_config', JSON.stringify({
    owner: config.owner, repo: config.repo, branch: config.branch
  }));

  currentPath = [];
  await loadDirectory('');
}

// ── Load a directory ───────────────────────────────────────────────────────
async function loadDirectory(path) {
  showLoading(true);
  hideError();
  closeViewer();

  try {
    const endpoint = `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
    const items = await ghFetch(endpoint);

    currentPath = path ? path.split('/') : [];
    renderBreadcrumb();
    renderFileList(items);

    document.getElementById('content').style.display = 'block';
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// ── Load and display a file ────────────────────────────────────────────────
async function loadFile(path, name) {
  showLoading(true);

  try {
    const endpoint = `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${config.branch}`;
    const data = await ghFetch(endpoint);

    let content;
    if (data.encoding === 'base64') {
      content = atob(data.content.replace(/\n/g, ''));
    } else {
      content = data.content;
    }

    document.getElementById('viewerTitle').textContent = name;
    document.getElementById('viewerContent').textContent = content;
    document.getElementById('fileViewer').style.display = 'block';

    // Scroll to viewer
    document.getElementById('fileViewer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message);
  } finally {
    showLoading(false);
  }
}

// ── Render breadcrumb ──────────────────────────────────────────────────────
function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  const parts = [
    `<span onclick="loadDirectory('')">${config.repo}</span>`
  ];

  currentPath.forEach((part, i) => {
    const path = currentPath.slice(0, i + 1).join('/');
    parts.push(`/ <span onclick="loadDirectory('${path}')">${part}</span>`);
  });

  el.innerHTML = parts.join(' ');
}

// ── Render file list ───────────────────────────────────────────────────────
function renderFileList(items) {
  const el = document.getElementById('fileList');

  // Sort: folders first, then files
  items.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  el.innerHTML = items.map(item => {
    const isDir = item.type === 'dir';
    const icon  = isDir ? '📂' : getFileIcon(item.name);
    const size  = isDir ? '' : `<span class="file-size">${formatSize(item.size)}</span>`;
    const cls   = isDir ? 'dir' : 'file';
    const action = isDir
      ? `loadDirectory('${item.path}')`
      : `loadFile('${item.path}', '${item.name}')`;

    return `
      <div class="file-item ${cls}" onclick="${action}">
        <span class="file-icon">${icon}</span>
        <span class="file-name">${item.name}</span>
        ${size}
      </div>`;
  }).join('');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const map = {
    js: '📜', ts: '📜', jsx: '📜', tsx: '📜',
    py: '🐍', rb: '💎', go: '🐹', rs: '🦀',
    html: '🌐', css: '🎨', scss: '🎨',
    json: '📋', yaml: '📋', yml: '📋', toml: '📋',
    md: '📝', txt: '📄', pdf: '📕',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '🖼️',
    sh: '⚙️', bash: '⚙️', zsh: '⚙️',
    zip: '📦', tar: '📦', gz: '📦',
  };
  return map[ext] || '📄';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function closeViewer() {
  document.getElementById('fileViewer').style.display = 'none';
  document.getElementById('viewerContent').textContent = '';
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'block' : 'none';
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = `⚠️ ${msg}`;
  el.style.display = 'block';
}

function hideError() {
  document.getElementById('error').style.display = 'none';
}
