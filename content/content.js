/**
 * iThinkAI - Content Script
 * 拦截 AI 平台的发送操作，强制用户先思考再提交
 */

(function () {
  'use strict';

  // ============ 平台配置 ============
  // 每个平台的发送按钮选择器和输入框选择器
  const PLATFORM_CONFIGS = {
    'chatgpt.com': {
      sendButtonSelector: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
      inputSelector: '#prompt-textarea, div[contenteditable="true"]',
      name: 'ChatGPT',
    },
    'chat.openai.com': {
      sendButtonSelector: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
      inputSelector: '#prompt-textarea, div[contenteditable="true"]',
      name: 'ChatGPT',
    },
    'claude.ai': {
      sendButtonSelector: 'button[aria-label="Send Message"], button[aria-label="Send message"]',
      inputSelector: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
      name: 'Claude',
    },
    'gemini.google.com': {
      sendButtonSelector: 'button.send-button, button[aria-label="Send message"]',
      inputSelector: '.ql-editor, div[contenteditable="true"], rich-textarea div[contenteditable]',
      name: 'Gemini',
    },
    'chat.deepseek.com': {
      sendButtonSelector: 'div[role="button"][aria-disabled], button[class*="send"], textarea + button',
      inputSelector: 'textarea',
      name: 'DeepSeek',
    },
    'kimi.moonshot.cn': {
      sendButtonSelector: 'button[class*="send"], div[class*="send"]',
      inputSelector: 'div[contenteditable="true"], textarea',
      name: 'Kimi',
    },
    'chat.mistral.ai': {
      sendButtonSelector: 'button[type="submit"], button[aria-label*="send" i]',
      inputSelector: 'textarea',
      name: 'Mistral',
    },
    'poe.com': {
      sendButtonSelector: 'button[class*="Send"], button[aria-label*="send" i]',
      inputSelector: 'textarea',
      name: 'Poe',
    },
    'copilot.microsoft.com': {
      sendButtonSelector: 'button[aria-label*="submit" i], button[aria-label*="send" i]',
      inputSelector: 'textarea, #searchbox',
      name: 'Copilot',
    },
    'tongyi.aliyun.com': {
      sendButtonSelector: 'button[class*="send"], div[class*="operateBtn"]',
      inputSelector: 'textarea, div[contenteditable="true"]',
      name: '通义千问',
    },
  };

  // ============ 状态管理 ============
  let settings = {
    enabled: true,
    countdownSeconds: 10,
    requireThinking: false, // 是否强制写下思考才能发送
    showThinkingBox: true,
  };

  let isIntercepting = false;
  let currentPlatform = null;
  let pendingSendEvent = null;

  // ============ 初始化 ============
  function init() {
    const hostname = window.location.hostname;
    currentPlatform = PLATFORM_CONFIGS[hostname];

    if (!currentPlatform) return;

    loadSettings().then(() => {
      setupInterception();
      setupKeyboardInterception();
      console.log(`[iThinkAI] Activated on ${currentPlatform.name}`);
    });

    // 监听设置变化
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings) {
        settings = { ...settings, ...changes.settings.newValue };
      }
    });
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        settings = { ...settings, ...result.settings };
      }
    } catch (e) {
      console.warn('[iThinkAI] Failed to load settings:', e);
    }
  }

  // ============ 拦截逻辑 ============

  function setupInterception() {
    // 使用事件委托在 capture 阶段拦截点击
    document.addEventListener('click', handleClick, true);

    // 监控 DOM 变化，为动态加载的按钮也添加拦截
    const observer = new MutationObserver(() => {
      // 按钮可能被动态替换，不需要额外处理，因为我们用事件委托
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setupKeyboardInterception() {
    // 拦截 Enter 键发送（大多数 AI 平台支持 Enter 发送）
    document.addEventListener('keydown', handleKeydown, true);
  }

  function handleClick(event) {
    if (!settings.enabled || isIntercepting) return;

    const sendButton = event.target.closest(currentPlatform.sendButtonSelector);
    if (!sendButton) return;

    const userInput = getUserInput();
    if (!userInput.trim()) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    pendingSendEvent = { type: 'click', target: sendButton };
    showThinkingModal(userInput);
  }

  function handleKeydown(event) {
    if (!settings.enabled || isIntercepting) return;

    // 拦截 Enter（非 Shift+Enter）在输入框中的发送
    if (event.key === 'Enter' && !event.shiftKey) {
      const inputEl = document.querySelector(currentPlatform.inputSelector);
      if (!inputEl) return;

      // 检查焦点是否在输入框内
      if (!inputEl.contains(event.target) && event.target !== inputEl) return;

      const userInput = getUserInput();
      if (!userInput.trim()) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      pendingSendEvent = { type: 'keyboard', target: inputEl };
      showThinkingModal(userInput);
    }
  }

  function getUserInput() {
    const inputEl = document.querySelector(currentPlatform.inputSelector);
    if (!inputEl) return '';
    return inputEl.innerText || inputEl.value || '';
  }

  // ============ 发送恢复 ============

  function resumeSend() {
    if (!pendingSendEvent) return;

    isIntercepting = true;

    if (pendingSendEvent.type === 'click') {
      pendingSendEvent.target.click();
    } else if (pendingSendEvent.type === 'keyboard') {
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      pendingSendEvent.target.dispatchEvent(enterEvent);
    }

    pendingSendEvent = null;

    // 短暂延迟后恢复拦截
    setTimeout(() => {
      isIntercepting = false;
    }, 500);
  }

  // ============ 思考弹窗 ============

  function showThinkingModal(userQuestion) {
    // 移除已有弹窗
    const existing = document.getElementById('ai-pause-think-modal');
    if (existing) existing.remove();

    let countdown = settings.countdownSeconds;
    let thinkingStartTime = Date.now();
    let timerInterval = null;

    // 创建遮罩层
    const overlay = document.createElement('div');
    overlay.id = 'ai-pause-think-modal';
    overlay.className = 'apt-overlay';

    // 创建弹窗
    const modal = document.createElement('div');
    modal.className = 'apt-modal';

    // 头部
    const header = document.createElement('div');
    header.className = 'apt-header';
    header.innerHTML = `
      <div class="apt-header-icon">🧠</div>
      <h2 class="apt-title">先想一想</h2>
      <p class="apt-subtitle">在 AI 回答之前，花点时间自己思考</p>
    `;

    // 用户的问题展示
    const questionSection = document.createElement('div');
    questionSection.className = 'apt-question-section';
    const truncatedQuestion = userQuestion.length > 200
      ? userQuestion.substring(0, 200) + '...'
      : userQuestion;
    questionSection.innerHTML = `
      <div class="apt-label">你的问题</div>
      <div class="apt-question-text">${escapeHtml(truncatedQuestion)}</div>
    `;

    // 思考输入区
    const thinkingSection = document.createElement('div');
    thinkingSection.className = 'apt-thinking-section';
    if (settings.showThinkingBox) {
      thinkingSection.innerHTML = `
        <div class="apt-label">写下你的想法 ${settings.requireThinking ? '<span class="apt-required">*必填</span>' : '<span class="apt-optional">(可选)</span>'}</div>
        <textarea class="apt-textarea" placeholder="如果是我来回答这个问题，我会说...&#10;&#10;写下你的初步想法，之后可以和 AI 的回答对比"></textarea>
      `;
    }

    // 倒计时区域
    const timerSection = document.createElement('div');
    timerSection.className = 'apt-timer-section';
    timerSection.innerHTML = `
      <div class="apt-timer-ring">
        <svg viewBox="0 0 100 100">
          <circle class="apt-timer-bg" cx="50" cy="50" r="45"/>
          <circle class="apt-timer-progress" cx="50" cy="50" r="45"
            stroke-dasharray="${2 * Math.PI * 45}"
            stroke-dashoffset="0"/>
        </svg>
        <span class="apt-timer-text">${countdown}</span>
      </div>
      <div class="apt-timer-label">思考倒计时</div>
    `;

    // 按钮区域
    const actions = document.createElement('div');
    actions.className = 'apt-actions';
    actions.innerHTML = `
      <button class="apt-btn apt-btn-cancel" title="取消发送">取消</button>
      <button class="apt-btn apt-btn-skip" title="跳过思考直接发送" style="display:none;">跳过并发送</button>
      <button class="apt-btn apt-btn-send" disabled title="倒计时结束后可发送">
        <span class="apt-btn-send-text">思考中...</span>
      </button>
    `;

    // 组装
    modal.appendChild(header);
    modal.appendChild(questionSection);
    modal.appendChild(thinkingSection);
    modal.appendChild(timerSection);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 聚焦到思考输入框
    const textarea = overlay.querySelector('.apt-textarea');
    if (textarea) {
      setTimeout(() => textarea.focus(), 100);
    }

    // 获取元素引用
    const progressCircle = overlay.querySelector('.apt-timer-progress');
    const timerText = overlay.querySelector('.apt-timer-text');
    const sendBtn = overlay.querySelector('.apt-btn-send');
    const sendBtnText = overlay.querySelector('.apt-btn-send-text');
    const cancelBtn = overlay.querySelector('.apt-btn-cancel');
    const skipBtn = overlay.querySelector('.apt-btn-skip');
    const circumference = 2 * Math.PI * 45;

    // 倒计时逻辑
    timerInterval = setInterval(() => {
      countdown--;
      timerText.textContent = countdown;

      // 更新进度环
      const progress = (settings.countdownSeconds - countdown) / settings.countdownSeconds;
      progressCircle.style.strokeDashoffset = circumference * (1 - progress);

      if (countdown <= 0) {
        clearInterval(timerInterval);
        timerText.textContent = '✓';
        sendBtn.disabled = false;
        sendBtnText.textContent = '发送给 AI';
        sendBtn.classList.add('apt-btn-ready');
        skipBtn.style.display = 'none';

        // 如果要求必须写思考，检查是否已写
        if (settings.requireThinking && textarea && !textarea.value.trim()) {
          sendBtn.disabled = true;
          sendBtnText.textContent = '请先写下想法';
        }
      }
    }, 1000);

    // 3秒后显示跳过按钮
    setTimeout(() => {
      if (overlay.isConnected && countdown > 0) {
        skipBtn.style.display = '';
      }
    }, 3000);

    // 如果 requireThinking，监听 textarea 输入
    if (settings.requireThinking && textarea) {
      textarea.addEventListener('input', () => {
        if (countdown <= 0) {
          sendBtn.disabled = !textarea.value.trim();
          sendBtnText.textContent = textarea.value.trim() ? '发送给 AI' : '请先写下想法';
        }
      });
    }

    // 按钮事件
    cancelBtn.addEventListener('click', () => {
      clearInterval(timerInterval);
      overlay.remove();
      pendingSendEvent = null;
    });

    skipBtn.addEventListener('click', () => {
      clearInterval(timerInterval);
      saveThinkingRecord(userQuestion, textarea?.value || '', Date.now() - thinkingStartTime);
      overlay.remove();
      resumeSend();
    });

    sendBtn.addEventListener('click', () => {
      if (sendBtn.disabled) return;
      clearInterval(timerInterval);
      saveThinkingRecord(userQuestion, textarea?.value || '', Date.now() - thinkingStartTime);
      overlay.remove();
      resumeSend();
    });

    // ESC 取消
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        clearInterval(timerInterval);
        overlay.remove();
        pendingSendEvent = null;
        document.removeEventListener('keydown', escHandler, true);
      }
    };
    document.addEventListener('keydown', escHandler, true);

    // 防止弹窗内的 Enter 触发发送
    modal.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && e.target === textarea) {
        // 允许 textarea 内换行
      }
    }, true);
  }

  // ============ 记录保存 ============

  async function saveThinkingRecord(question, thinking, durationMs) {
    try {
      const result = await chrome.storage.local.get(['thinkingHistory', 'stats']);
      const history = result.thinkingHistory || [];
      const stats = result.stats || { totalSessions: 0, totalThinkingTime: 0, thoughtsWritten: 0 };

      const record = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        platform: currentPlatform.name,
        question: question.substring(0, 500),
        thinking: thinking.substring(0, 2000),
        durationMs,
      };

      // 保留最近 200 条记录
      history.unshift(record);
      if (history.length > 200) history.pop();

      stats.totalSessions++;
      stats.totalThinkingTime += durationMs;
      if (thinking.trim()) stats.thoughtsWritten++;

      await chrome.storage.local.set({ thinkingHistory: history, stats });
    } catch (e) {
      console.warn('[iThinkAI] Failed to save record:', e);
    }
  }

  // ============ 工具函数 ============

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============ 启动 ============
  init();
})();
