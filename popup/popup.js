/**
 * iThinkAI - Popup Script
 * 设置页面、思考记录和统计
 */

const PLATFORMS = [
  { host: 'chatgpt.com', name: 'ChatGPT' },
  { host: 'chat.openai.com', name: 'ChatGPT (旧域名)' },
  { host: 'claude.ai', name: 'Claude' },
  { host: 'gemini.google.com', name: 'Gemini' },
  { host: 'chat.deepseek.com', name: 'DeepSeek' },
  { host: 'kimi.moonshot.cn', name: 'Kimi' },
  { host: 'chat.mistral.ai', name: 'Mistral' },
  { host: 'poe.com', name: 'Poe' },
  { host: 'copilot.microsoft.com', name: 'Copilot' },
  { host: 'tongyi.aliyun.com', name: '通义千问' },
];

const DEFAULT_SETTINGS = {
  enabled: true,
  countdownSeconds: 10,
  showThinkingBox: true,
  requireThinking: false,
  disabledPlatforms: [],
};

let settings = { ...DEFAULT_SETTINGS };

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  renderSettings();
  renderPlatforms();
  setupTabs();
  setupEventListeners();
  loadHistory();
  loadStats();
});

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('settings');
    if (result.settings) {
      settings = { ...DEFAULT_SETTINGS, ...result.settings };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ settings });
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

// ============ 设置渲染 ============

function renderSettings() {
  document.getElementById('enabled').checked = settings.enabled;
  document.getElementById('countdown-value').textContent = settings.countdownSeconds;
  document.getElementById('showThinkingBox').checked = settings.showThinkingBox;
  document.getElementById('requireThinking').checked = settings.requireThinking;
}

function renderPlatforms() {
  const container = document.getElementById('platforms-list');
  container.innerHTML = PLATFORMS.map(p => `
    <div class="platform-item">
      <span class="platform-name">${p.name}</span>
      <label class="toggle">
        <input type="checkbox" data-platform="${p.host}"
          ${settings.disabledPlatforms.includes(p.host) ? '' : 'checked'}>
        <span class="toggle-slider"></span>
      </label>
    </div>
  `).join('');
}

// ============ 标签页 ============

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

      if (tab.dataset.tab === 'history') loadHistory();
      if (tab.dataset.tab === 'stats') loadStats();
    });
  });
}

// ============ 事件监听 ============

function setupEventListeners() {
  // 主开关
  document.getElementById('enabled').addEventListener('change', (e) => {
    settings.enabled = e.target.checked;
    saveSettings();
  });

  // 倒计时
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

  // 显示思考框
  document.getElementById('showThinkingBox').addEventListener('change', (e) => {
    settings.showThinkingBox = e.target.checked;
    saveSettings();
  });

  // 强制思考
  document.getElementById('requireThinking').addEventListener('change', (e) => {
    settings.requireThinking = e.target.checked;
    saveSettings();
  });

  // 平台开关
  document.getElementById('platforms-list').addEventListener('change', (e) => {
    if (!e.target.dataset.platform) return;
    const host = e.target.dataset.platform;
    if (e.target.checked) {
      settings.disabledPlatforms = settings.disabledPlatforms.filter(p => p !== host);
    } else {
      settings.disabledPlatforms = [...settings.disabledPlatforms, host];
    }
    saveSettings();
  });

  // 清空记录
  document.getElementById('clear-history').addEventListener('click', async () => {
    await chrome.storage.local.set({ thinkingHistory: [], stats: { totalSessions: 0, totalThinkingTime: 0, thoughtsWritten: 0 } });
    loadHistory();
    loadStats();
  });
}

// ============ 历史记录 ============

async function loadHistory() {
  const result = await chrome.storage.local.get('thinkingHistory');
  const history = result.thinkingHistory || [];
  const container = document.getElementById('history-list');

  if (history.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无思考记录<br>使用 AI 时会自动记录</div>';
    return;
  }

  container.innerHTML = history.slice(0, 50).map(item => {
    const date = new Date(item.timestamp);
    const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const durationStr = Math.round(item.durationMs / 1000) + 's';
    const question = item.question.length > 80 ? item.question.substring(0, 80) + '...' : item.question;
    const thinkingHtml = item.thinking
      ? `<div class="history-thinking">${escapeHtml(item.thinking.substring(0, 150))}</div>`
      : '';

    return `
      <div class="history-item">
        <div class="history-meta">
          <span>${item.platform} · ${timeStr}</span>
          <span>思考 ${durationStr}</span>
        </div>
        <div class="history-question">${escapeHtml(question)}</div>
        ${thinkingHtml}
      </div>
    `;
  }).join('');
}

// ============ 统计 ============

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

// ============ 工具函数 ============

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
