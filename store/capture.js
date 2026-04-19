#!/usr/bin/env node
/**
 * Auto-capture screenshots for Chrome Web Store listing
 * Uses Playwright to render the extension UIs and takes real screenshots
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, 'screenshots-real');

const STORE_W = 1280;
const STORE_H = 800;

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: STORE_W, height: STORE_H },
    deviceScaleFactor: 2,
  });

  // ============ 1. 思考弹窗（在 ChatGPT 模拟页上）============
  await captureModal(context);

  // ============ 2. 设置面板（popup settings）============
  await capturePopupSettings(context);

  // ============ 3. 思考历史（popup history）============
  await capturePopupHistory(context);

  // ============ 4. 统计面板（popup stats）============
  await capturePopupStats(context);

  // ============ 5. 代理警告页 ============
  await captureBlockedPage(context);

  await browser.close();
  console.log('\n✅ All screenshots generated in:', OUT);
}

// ============ 帮助函数：把 popup 嵌入到 store 风格展示页中 ============

async function renderPopupCard(context, activeTab, mockStorage) {
  const page = await context.newPage();
  const popupPath = 'file://' + path.resolve(ROOT, 'popup/popup.html');

  // 包装页面：左侧标题 + 右侧 popup 预览
  const wrapperHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, 'PingFang SC', sans-serif; }
  body { width: ${STORE_W}px; height: ${STORE_H}px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; }
  .left { flex: 1; padding: 80px; color: white; }
  .left h1 { font-size: 64px; font-weight: 800; line-height: 1.15; margin-bottom: 20px; }
  .left p { font-size: 22px; line-height: 1.6; opacity: 0.92; }
  .left .brand { display: inline-block; padding: 6px 16px; background: rgba(255,255,255,0.2); border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 28px; backdrop-filter: blur(10px); }
  .right { width: 440px; padding-right: 80px; display: flex; justify-content: center; }
  iframe {
    width: 360px;
    height: 640px;
    border: none;
    border-radius: 24px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.35);
    background: white;
  }
</style></head><body>
  <div class="left">
    <div class="brand">🧠 iThinkAI</div>
    <h1 id="title"></h1>
    <p id="sub"></p>
  </div>
  <div class="right">
    <iframe id="pop" src="${popupPath}"></iframe>
  </div>
</body></html>`;

  const htmlFile = path.resolve(OUT, `_wrapper_${activeTab}.html`);
  fs.writeFileSync(htmlFile, wrapperHtml);
  await page.goto('file://' + htmlFile);

  return page;
}

// ============ 1. Modal on mock ChatGPT ============
async function captureModal(context) {
  console.log('📸 [1/5] Capturing thinking modal...');
  const page = await context.newPage();
  const mockUrl = 'file://' + path.resolve(ROOT, 'store/mock/chatgpt-mock.html');
  await page.goto(mockUrl);
  await page.waitForTimeout(500);

  // 读取 content.css 并注入
  const css = fs.readFileSync(path.resolve(ROOT, 'content/content.css'), 'utf-8');
  await page.addStyleTag({ content: css });

  // 注入思考弹窗 HTML（模拟 content.js 中的构造）
  await page.evaluate(() => {
    const overlay = document.createElement('div');
    overlay.className = 'apt-overlay';
    const modal = document.createElement('div');
    modal.className = 'apt-modal';

    modal.innerHTML = `
      <div class="apt-header">
        <div class="apt-header-icon">🧠</div>
        <h2 class="apt-title">先想一想</h2>
        <p class="apt-subtitle">在 AI 回答之前，花点时间自己思考</p>
      </div>
      <div class="apt-question-section">
        <div class="apt-label">你的问题</div>
        <div class="apt-question-text">为什么 AI 会让人变懒？怎样才能不依赖 AI 保持独立思考？</div>
      </div>
      <div class="apt-thinking-section">
        <div class="apt-label">写下你的想法 <span class="apt-optional">(可选)</span></div>
        <textarea class="apt-textarea">我觉得 AI 让人变懒，是因为它把思考的"过程"省略了——我们直接拿到答案，跳过了推导。要保持独立思考，也许要在问 AI 之前先强迫自己给出一个粗略答案...</textarea>
      </div>
      <div class="apt-timer-section">
        <div class="apt-timer-ring">
          <svg viewBox="0 0 100 100">
            <circle class="apt-timer-bg" cx="50" cy="50" r="45"/>
            <circle class="apt-timer-progress" cx="50" cy="50" r="45"
              stroke-dasharray="${2 * Math.PI * 45}"
              stroke-dashoffset="${2 * Math.PI * 45 * 0.3}"/>
          </svg>
          <span class="apt-timer-text">7</span>
        </div>
        <div class="apt-timer-label">思考倒计时</div>
      </div>
      <div class="apt-actions">
        <button class="apt-btn apt-btn-cancel">取消</button>
        <button class="apt-btn apt-btn-skip">跳过并发送</button>
        <button class="apt-btn apt-btn-send" disabled>
          <span class="apt-btn-send-text">思考中...</span>
        </button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });

  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(OUT, '01_modal_thinking.png'),
    fullPage: false,
  });
  await page.close();
  console.log('   ✓ 01_modal_thinking.png');
}

// ============ 2. Popup Settings ============
async function capturePopupSettings(context) {
  console.log('📸 [2/5] Capturing popup settings...');
  const page = await renderPopupCard(context, 'settings');
  await page.evaluate(() => {
    document.getElementById('title').textContent = '按你的节奏来';
    document.getElementById('sub').textContent = '倒计时、平台开关、代理检测 —— 一切由你控制';
  });

  // 等 iframe 加载完，设置模拟数据
  await page.waitForTimeout(800);
  const frame = page.frameLocator('#pop');
  // settings tab 默认就是打开的
  await page.waitForTimeout(500);

  await page.screenshot({
    path: path.join(OUT, '02_settings.png'),
    fullPage: false,
  });
  await page.close();
  console.log('   ✓ 02_settings.png');
}

// ============ 3. Popup History ============
async function capturePopupHistory(context) {
  console.log('📸 [3/5] Capturing popup history...');

  // 为 popup 预先注入一些模拟历史数据
  // popup.js 通过 chrome.storage.local 读，这里我们没有扩展环境
  // 所以改用一个包装页面，直接注入 storage mock 再加载 popup

  const page = await context.newPage();

  const mockHistory = [
    {
      id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(),
      platform: 'ChatGPT',
      question: '为什么 AI 会让人变懒？怎样才能不依赖 AI 保持独立思考？',
      thinking: '我觉得 AI 让人变懒是因为它把思考过程省略了——直接给答案。要保持思考，也许要在问 AI 之前先给出自己的粗略答案。',
      durationMs: 18000,
    },
    {
      id: '2', timestamp: new Date(Date.now() - 7200000).toISOString(),
      platform: 'Claude',
      question: '解释一下第一性原理思考',
      thinking: '第一性原理就是从最基础的事实出发推理，不靠类比。就像做物理题时从公理推导而不是背公式。',
      durationMs: 22000,
    },
    {
      id: '3', timestamp: new Date(Date.now() - 86400000).toISOString(),
      platform: 'Gemini',
      question: '如何设计一个好的用户增长策略？',
      thinking: '用户增长不是拉人，是让合适的人主动来、留下。核心是产品价值，其次是传播性。',
      durationMs: 31000,
    },
    {
      id: '4', timestamp: new Date(Date.now() - 172800000).toISOString(),
      platform: 'ChatGPT',
      question: 'React 和 Vue 在响应式原理上有什么本质区别？',
      thinking: '',
      durationMs: 8000,
    },
  ];

  const wrapperHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, 'PingFang SC', sans-serif; }
  body { width: ${STORE_W}px; height: ${STORE_H}px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); display: flex; align-items: center; }
  .left { flex: 1; padding: 80px; color: white; }
  .left h1 { font-size: 64px; font-weight: 800; line-height: 1.15; margin-bottom: 20px; }
  .left p { font-size: 22px; line-height: 1.6; opacity: 0.95; }
  .left .brand { display: inline-block; padding: 6px 16px; background: rgba(255,255,255,0.22); border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 28px; backdrop-filter: blur(10px); }
  .right { width: 440px; padding-right: 80px; display: flex; justify-content: center; }
  #pop-host {
    width: 360px;
    height: 640px;
    border: none;
    border-radius: 24px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.35);
    background: white;
    overflow: hidden;
    position: relative;
  }
  #pop-host iframe { width: 100%; height: 100%; border: none; }
</style></head><body>
  <div class="left">
    <div class="brand">🧠 iThinkAI</div>
    <h1>思考留痕迹</h1>
    <p>每一次思考都被温柔记录下<br>回看时，你会看见自己的成长</p>
  </div>
  <div class="right">
    <div id="pop-host"><iframe id="pop"></iframe></div>
  </div>

  <script>
    const HISTORY = ${JSON.stringify(mockHistory)};
    const STATS = { totalSessions: 47, totalThinkingTime: 892000, thoughtsWritten: 38 };
    const SETTINGS = { enabled: true, countdownSeconds: 10, showThinkingBox: true, requireThinking: false, proxyCheckEnabled: true, disabledPlatforms: [] };

    // 在 iframe 加载前先劫持其 chrome.storage
    const iframe = document.getElementById('pop');
    iframe.addEventListener('load', () => {
      // 注入模拟数据并切到 history tab
      const doc = iframe.contentDocument;
      const historyTab = doc.querySelector('[data-tab="history"]');
      if (historyTab) historyTab.click();

      // 等 popup.js 的 loadHistory 被触发后再手动渲染
      setTimeout(() => {
        const container = doc.getElementById('history-list');
        if (!container) return;
        container.innerHTML = HISTORY.slice(0, 5).map(item => {
          const date = new Date(item.timestamp);
          const timeStr = (date.getMonth() + 1) + '/' + date.getDate() + ' ' +
            String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
          const durationStr = Math.round(item.durationMs / 1000) + 's';
          const q = item.question.length > 80 ? item.question.substring(0, 80) + '...' : item.question;
          const thinkingHtml = item.thinking
            ? '<div class="history-thinking">' + escape(item.thinking.substring(0, 150)) + '</div>'
            : '';
          return '<div class="history-item">' +
            '<div class="history-meta"><span>' + item.platform + ' · ' + timeStr + '</span>' +
            '<span>思考 ' + durationStr + '</span></div>' +
            '<div class="history-question">' + escape(q) + '</div>' +
            thinkingHtml + '</div>';
        }).join('');

        function escape(s) {
          const d = doc.createElement('div');
          d.textContent = s;
          return d.innerHTML;
        }
      }, 400);
    });

    // 劫持 chrome.storage / chrome.runtime，让 popup.js 不报错
    const storageStub = {
      local: {
        get: async (key) => {
          if (key === 'settings') return { settings: SETTINGS };
          if (key === 'thinkingHistory') return { thinkingHistory: HISTORY };
          if (key === 'stats') return { stats: STATS };
          return {};
        },
        set: async () => {},
      }
    };
    iframe.addEventListener('load', () => {
      const win = iframe.contentWindow;
      win.chrome = win.chrome || {};
      win.chrome.storage = storageStub;
      win.chrome.runtime = {
        sendMessage: async () => ({ hasProxy: true, timestamp: Date.now(), stale: false }),
      };
    }, { once: true });

    // 现在加载 popup
    iframe.src = 'file://${path.resolve(ROOT, 'popup/popup.html')}';
  </script>
</body></html>`;

  const htmlFile = path.resolve(OUT, '_wrapper_history.html');
  fs.writeFileSync(htmlFile, wrapperHtml);
  await page.goto('file://' + htmlFile);
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(OUT, '03_history.png'),
    fullPage: false,
  });
  await page.close();
  console.log('   ✓ 03_history.png');
}

// ============ 4. Popup Stats ============
async function capturePopupStats(context) {
  console.log('📸 [4/5] Capturing popup stats...');
  const page = await context.newPage();

  const wrapperHtml = `
<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, 'PingFang SC', sans-serif; }
  body { width: ${STORE_W}px; height: ${STORE_H}px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); display: flex; align-items: center; }
  .left { flex: 1; padding: 80px; color: white; }
  .left h1 { font-size: 64px; font-weight: 800; line-height: 1.15; margin-bottom: 20px; text-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .left p { font-size: 22px; line-height: 1.6; opacity: 0.95; }
  .left .brand { display: inline-block; padding: 6px 16px; background: rgba(255,255,255,0.22); border-radius: 20px; font-size: 13px; font-weight: 600; margin-bottom: 28px; backdrop-filter: blur(10px); }
  .right { width: 440px; padding-right: 80px; display: flex; justify-content: center; }
  #pop-host {
    width: 360px;
    height: 640px;
    border: none;
    border-radius: 24px;
    box-shadow: 0 30px 80px rgba(0,0,0,0.35);
    background: white;
    overflow: hidden;
  }
  #pop-host iframe { width: 100%; height: 100%; border: none; }
</style></head><body>
  <div class="left">
    <div class="brand">🧠 iThinkAI</div>
    <h1>思考有据可查</h1>
    <p>看见自己累计了多少独立思考<br>每一次都算数</p>
  </div>
  <div class="right">
    <div id="pop-host"><iframe id="pop"></iframe></div>
  </div>

  <script>
    const STATS = { totalSessions: 47, totalThinkingTime: 892000, thoughtsWritten: 38 };
    const SETTINGS = { enabled: true, countdownSeconds: 10, showThinkingBox: true, requireThinking: false, proxyCheckEnabled: true, disabledPlatforms: [] };
    const iframe = document.getElementById('pop');

    iframe.addEventListener('load', () => {
      const win = iframe.contentWindow;
      win.chrome = win.chrome || {};
      win.chrome.storage = {
        local: {
          get: async (key) => {
            if (key === 'settings') return { settings: SETTINGS };
            if (key === 'stats') return { stats: STATS };
            return {};
          },
          set: async () => {},
        }
      };
      win.chrome.runtime = { sendMessage: async () => ({ hasProxy: true }) };

      const doc = iframe.contentDocument;
      const tab = doc.querySelector('[data-tab="stats"]');
      if (tab) tab.click();

      setTimeout(() => {
        doc.getElementById('stat-sessions').textContent = '47';
        doc.getElementById('stat-time').textContent = '15m';
        doc.getElementById('stat-written').textContent = '38';
        doc.getElementById('stat-rate').textContent = '81%';
      }, 400);
    }, { once: true });

    iframe.src = 'file://${path.resolve(ROOT, 'popup/popup.html')}';
  </script>
</body></html>`;

  const htmlFile = path.resolve(OUT, '_wrapper_stats.html');
  fs.writeFileSync(htmlFile, wrapperHtml);
  await page.goto('file://' + htmlFile);
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(OUT, '04_stats.png'),
    fullPage: false,
  });
  await page.close();
  console.log('   ✓ 04_stats.png');
}

// ============ 5. Blocked (Proxy Warning) ============
async function captureBlockedPage(context) {
  console.log('📸 [5/5] Capturing proxy warning page...');
  const page = await context.newPage();
  const url = 'file://' + path.resolve(ROOT, 'blocked/blocked.html') +
    '?target=' + encodeURIComponent('https://chatgpt.com/') +
    '&site=' + encodeURIComponent('chatgpt.com') +
    '&tabId=1';
  await page.goto(url);

  // 把自动检测按钮禁用，避免出错影响视觉
  await page.evaluate(() => {
    // 防止自动重检触发错误
    window.chrome = window.chrome || {};
    window.chrome.runtime = {
      sendMessage: () => Promise.reject(new Error('mock')),
    };
  });

  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(OUT, '05_proxy_warning.png'),
    fullPage: false,
  });
  await page.close();
  console.log('   ✓ 05_proxy_warning.png');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
