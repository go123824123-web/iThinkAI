/**
 * iThinkAI — Popup Script
 * Settings, history log, and stats panel. i18n-aware.
 */

const t = (key, sub) => {
  try {
    return chrome.i18n.getMessage(key, sub) || key;
  } catch (e) {
    return key;
  }
};

const PLATFORMS = [
  { host: 'chatgpt.com', nameKey: 'platformChatGPT' },
  { host: 'chat.openai.com', nameKey: 'platformChatGPTLegacy' },
  { host: 'claude.ai', nameKey: 'platformClaude' },
  { host: 'gemini.google.com', nameKey: 'platformGemini' },
  { host: 'chat.deepseek.com', nameKey: 'platformDeepSeek' },
  { host: 'kimi.moonshot.cn', nameKey: 'platformKimi' },
  { host: 'chat.mistral.ai', nameKey: 'platformMistral' },
  { host: 'poe.com', nameKey: 'platformPoe' },
  { host: 'copilot.microsoft.com', nameKey: 'platformCopilot' },
  { host: 'tongyi.aliyun.com', nameKey: 'platformTongyi' },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  countdownSeconds: 10,
  showThinkingBox: true,
  requireThinking: false,
  disabledPlatforms: [],
};

let settings = { ...DEFAULT_SETTINGS };

document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  await loadSettings();
  renderSettings();
  renderPlatforms();
  setupTabs();
  setupEventListeners();
  loadHistory();
  loadStats();
});

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  document.title = t('extName') || 'iThinkAI';
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    if (result.settings) {
      settings = { ...DEFAULT_SETTINGS, ...result.settings };
    }
  } catch (e) { /* keep defaults */ }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings });
  } catch (e) { /* ignore */ }
}

function renderSettings() {
  document.getElementById('enabled').checked = settings.enabled;
  document.getElementById('countdown-value').textContent = settings.countdownSeconds;
  document.getElementById('showThinkingBox').checked = settings.showThinkingBox;
  document.getElementById('requireThinking').checked = settings.requireThinking;
}

function renderPlatforms() {
  const container = document.getElementById('platforms-list');
  container.innerHTML = PLATFORMS.map((p) => `
    <div class="platform-item">
      <span class="platform-name">${t(p.nameKey)}</span>
      <label class="toggle">
        <input type="checkbox" data-platform="${p.host}"
          ${settings.disabledPlatforms.includes(p.host) ? '' : 'checked'}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      if (tab.dataset.tab === 'history') loadHistory();
      if (tab.dataset.tab === 'stats') loadStats();
    });
  });
}

function setupEventListeners() {
  document.getElementById('enabled').addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    saveSettings();
  });

  document.getElementById('countdown-dec').addEventListener('click', () => {
    if (settings.countdownSeconds > 3) {
      settings.countdownSeconds--;
      document.getElementById('countdown-value').textContent = settings.countdownSeconds;
      saveSettings();
    }
  });

  document.getElementById('countdown-inc').addEventListener('click', () => {
    if (settings.countdownSeconds < 60) {
      settings.countdownSeconds++;
      document.getElementById('countdown-value').textContent = settings.countdownSeconds;
      saveSettings();
    }
  });

  document.getElementById('showThinkingBox').addEventListener('change', (e) => {
    settings.showThinkingBox = e.target.checked;
    saveSettings();
  });

  document.getElementById('requireThinking').addEventListener('change', (e) => {
    settings.requireThinking = e.target.checked;
    saveSettings();
  });

  document.getElementById('platforms-list').addEventListener('change', (e) => {
    if (!e.target.dataset.platform) return;
    const host = e.target.dataset.platform;
    if (e.target.checked) {
      settings.disabledPlatforms = settings.disabledPlatforms.filter((p) => p !== host);
    } else {
      settings.disabledPlatforms = [...settings.disabledPlatforms, host];
    }
    saveSettings();
  });

  document.getElementById('clear-history').addEventListener('click', async () => {
    await chrome.storage.local.set({
      thinkingHistory: [],
      stats: { totalSessions: 0, totalThinkingTime: 0, thoughtsWritten: 0 },
    });
    loadHistory();
    loadStats();
  });
}

async function loadHistory() {
  const result = await chrome.storage.local.get('thinkingHistory');
  const history = result.thinkingHistory || [];
  const container = document.getElementById('history-list');

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">${escapeHtml(t('emptyHistory'))}</div>
        ${escapeHtml(t('emptyHistoryHint'))}
      </div>
    `;
    return;
  }

  container.innerHTML = history.slice(0, 50).map((item) => {
    const d = new Date(item.timestamp);
    const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const seconds = Math.round(item.durationMs / 1000);
    const durationStr = t('thoughtDuration', [String(seconds)]);
    const question = item.question.length > 80 ? item.question.substring(0, 80) + '…' : item.question;
    const thinkingHtml = item.thinking
      ? `<div class="history-thinking">${escapeHtml(item.thinking.substring(0, 150))}</div>`
      : '';
    return `
      <div class="history-item">
        <div class="history-meta">
          <span>${escapeHtml(item.platform)} · ${timeStr}</span>
          <span>${escapeHtml(durationStr)}</span>
        </div>
        <div class="history-question">${escapeHtml(question)}</div>
        ${thinkingHtml}
      </div>
    `;
  }).join('');
}

async function loadStats() {
  const result = await chrome.storage.local.get('stats');
  const stats = result.stats || { totalSessions: 0, totalThinkingTime: 0, thoughtsWritten: 0 };

  document.getElementById('stat-sessions').textContent = stats.totalSessions;

  const totalMinutes = Math.round(stats.totalThinkingTime / 60000);
  document.getElementById('stat-time').textContent =
    totalMinutes >= 60 ? `${Math.round(totalMinutes / 60)}h` : `${totalMinutes}m`;

  document.getElementById('stat-written').textContent = stats.thoughtsWritten;

  const rate = stats.totalSessions > 0
    ? Math.round((stats.thoughtsWritten / stats.totalSessions) * 100)
    : 0;
  document.getElementById('stat-rate').textContent = `${rate}%`;
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
