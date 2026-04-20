/**
 * iThinkAI — Content Script
 * Intercepts AI send actions; opens an isolated Shadow DOM modal
 * that forces a pause and optionally captures the user's own thought.
 */
(function () {
  'use strict';

  const t = (key, sub) => {
    try {
      return chrome.i18n.getMessage(key, sub) || key;
    } catch (e) {
      return key;
    }
  };

  const PLATFORM_CONFIGS = {
    'chatgpt.com': {
      sendButtonSelector: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
      inputSelector: '#prompt-textarea, div[contenteditable="true"]',
      nameKey: 'platformChatGPT',
    },
    'chat.openai.com': {
      sendButtonSelector: 'button[data-testid="send-button"], button[aria-label="Send prompt"]',
      inputSelector: '#prompt-textarea, div[contenteditable="true"]',
      nameKey: 'platformChatGPT',
    },
    'claude.ai': {
      sendButtonSelector: 'button[aria-label="Send Message"], button[aria-label="Send message"]',
      inputSelector: 'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
      nameKey: 'platformClaude',
    },
    'gemini.google.com': {
      sendButtonSelector: 'button.send-button, button[aria-label="Send message"]',
      inputSelector: '.ql-editor, div[contenteditable="true"], rich-textarea div[contenteditable]',
      nameKey: 'platformGemini',
    },
    'chat.deepseek.com': {
      sendButtonSelector: 'div[role="button"][aria-disabled], button[class*="send"], textarea + button',
      inputSelector: 'textarea',
      nameKey: 'platformDeepSeek',
    },
    'kimi.moonshot.cn': {
      sendButtonSelector: 'button[class*="send"], div[class*="send"]',
      inputSelector: 'div[contenteditable="true"], textarea',
      nameKey: 'platformKimi',
    },
    'chat.mistral.ai': {
      sendButtonSelector: 'button[type="submit"], button[aria-label*="send" i]',
      inputSelector: 'textarea',
      nameKey: 'platformMistral',
    },
    'poe.com': {
      sendButtonSelector: 'button[class*="Send"], button[aria-label*="send" i]',
      inputSelector: 'textarea',
      nameKey: 'platformPoe',
    },
    'copilot.microsoft.com': {
      sendButtonSelector: 'button[aria-label*="submit" i], button[aria-label*="send" i]',
      inputSelector: 'textarea, #searchbox',
      nameKey: 'platformCopilot',
    },
    'tongyi.aliyun.com': {
      sendButtonSelector: 'button[class*="send"], div[class*="operateBtn"]',
      inputSelector: 'textarea, div[contenteditable="true"]',
      nameKey: 'platformTongyi',
    },
  };

  let settings = {
    enabled: true,
    countdownSeconds: 10,
    requireThinking: false,
    showThinkingBox: true,
    disabledPlatforms: [],
  };

  let isIntercepting = false;
  let currentPlatform = null;
  let currentHost = null;
  let pendingSendEvent = null;
  let openModalHost = null;

  function init() {
    currentHost = window.location.hostname;
    currentPlatform = PLATFORM_CONFIGS[currentHost];
    if (!currentPlatform) return;

    loadSettings().then(() => {
      document.addEventListener('click', handleClick, true);
      document.addEventListener('keydown', handleKeydown, true);
    });

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings) {
        settings = { ...settings, ...changes.settings.newValue };
      }
    });
  }

  async function loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      if (result.settings) settings = { ...settings, ...result.settings };
    } catch (e) { /* keep defaults */ }
  }

  function platformDisabled() {
    return (settings.disabledPlatforms || []).includes(currentHost);
  }

  function handleClick(event) {
    if (!settings.enabled || isIntercepting || platformDisabled()) return;
    if (openModalHost && openModalHost.contains(event.target)) return;

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
    if (!settings.enabled || isIntercepting || platformDisabled()) return;
    // Never intercept keys inside our own modal
    if (openModalHost && event.composedPath && event.composedPath().includes(openModalHost)) return;

    if (event.key !== 'Enter' || event.shiftKey) return;

    const inputEl = document.querySelector(currentPlatform.inputSelector);
    if (!inputEl) return;
    if (!inputEl.contains(event.target) && event.target !== inputEl) return;

    const userInput = getUserInput();
    if (!userInput.trim()) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    pendingSendEvent = { type: 'keyboard', target: inputEl };
    showThinkingModal(userInput);
  }

  function getUserInput() {
    const inputEl = document.querySelector(currentPlatform.inputSelector);
    if (!inputEl) return '';
    return inputEl.innerText || inputEl.value || '';
  }

  function resumeSend() {
    if (!pendingSendEvent) return;
    isIntercepting = true;
    try {
      if (pendingSendEvent.type === 'click') {
        pendingSendEvent.target.click();
      } else {
        const ev = new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
          bubbles: true, cancelable: true,
        });
        pendingSendEvent.target.dispatchEvent(ev);
      }
    } finally {
      pendingSendEvent = null;
      setTimeout(() => { isIntercepting = false; }, 500);
    }
  }

  /* ===================== Modal ===================== */

  const MODAL_CSS = `
    :host { all: initial; }
    .overlay {
      position: fixed; inset: 0;
      background: rgba(15, 12, 30, 0.55);
      backdrop-filter: blur(10px) saturate(140%);
      -webkit-backdrop-filter: blur(10px) saturate(140%);
      display: flex; align-items: center; justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
        Arial, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
      color: #1f2030;
      animation: fadeIn 0.22s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes softPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @keyframes shine {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(220%); }
    }

    .modal {
      position: relative;
      background: linear-gradient(180deg, #ffffff 0%, #f8f7ff 100%);
      border-radius: 24px;
      padding: 28px 28px 24px;
      width: 520px; max-width: 92vw; max-height: 88vh;
      overflow-y: auto;
      box-shadow:
        0 40px 80px -20px rgba(79, 70, 229, 0.35),
        0 20px 40px -10px rgba(0, 0, 0, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.9) inset;
      animation: slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .header {
      display: flex; flex-direction: column; align-items: center;
      gap: 6px; margin-bottom: 20px;
    }
    .logo {
      width: 56px; height: 56px;
      animation: softPulse 3.6s ease-in-out infinite;
      filter: drop-shadow(0 8px 14px rgba(99, 102, 241, 0.35));
    }
    .title {
      font-size: 22px; font-weight: 700; letter-spacing: -0.02em;
      margin: 4px 0 0;
      background: linear-gradient(90deg, #4f46e5, #8b5cf6);
      -webkit-background-clip: text; background-clip: text;
      color: transparent;
    }
    .subtitle {
      font-size: 13.5px; color: #6b7280; margin: 0;
    }

    .label {
      font-size: 11.5px; font-weight: 700;
      color: #6366f1; letter-spacing: 0.06em;
      text-transform: uppercase; margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .label-pill {
      font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 999px;
      letter-spacing: 0;
    }
    .pill-required { background: #fee2e2; color: #dc2626; }
    .pill-optional { background: #eef2ff; color: #6366f1; }

    .question {
      margin-bottom: 18px;
    }
    .question-text {
      background: rgba(99, 102, 241, 0.06);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 14px;
      padding: 12px 16px;
      font-size: 14px; line-height: 1.6;
      color: #374151;
      max-height: 108px; overflow-y: auto;
      word-break: break-word;
    }

    .thinking { margin-bottom: 22px; }
    textarea {
      width: 100%; min-height: 100px; max-height: 220px;
      padding: 14px 16px;
      border: 1.5px solid rgba(99, 102, 241, 0.2);
      border-radius: 14px;
      font-size: 14px; line-height: 1.6;
      color: #1f2937; background: #ffffff;
      resize: vertical; outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
      font-family: inherit;
      box-sizing: border-box;
    }
    textarea:focus {
      border-color: #6366f1;
      box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.14);
    }
    textarea::placeholder { color: #9ca3af; white-space: pre-line; }

    .timer {
      display: flex; flex-direction: column; align-items: center;
      margin: 8px 0 24px;
    }
    .timer-ring {
      position: relative; width: 78px; height: 78px;
      filter: drop-shadow(0 6px 14px rgba(99, 102, 241, 0.28));
    }
    .timer-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .timer-bg { fill: none; stroke: rgba(99, 102, 241, 0.12); stroke-width: 7; }
    .timer-progress {
      fill: none; stroke: url(#ringGrad); stroke-width: 7;
      stroke-linecap: round;
      transition: stroke-dashoffset 1s linear;
    }
    .timer-text {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 26px; font-weight: 800; letter-spacing: -0.02em;
      background: linear-gradient(135deg, #4f46e5, #a855f7);
      -webkit-background-clip: text; background-clip: text;
      color: transparent;
    }
    .timer-label { margin-top: 10px; font-size: 12px; color: #9ca3af; letter-spacing: 0.03em; }

    .actions {
      display: flex; gap: 10px; justify-content: flex-end; align-items: center;
    }
    .btn {
      padding: 11px 22px;
      border-radius: 14px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; border: none; outline: none;
      transition: transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease;
      font-family: inherit;
    }
    .btn:active { transform: translateY(1px); }
    .btn:disabled { cursor: not-allowed; opacity: 0.5; }

    .btn-cancel {
      background: rgba(0, 0, 0, 0.04);
      color: #6b7280;
    }
    .btn-cancel:hover { background: rgba(0, 0, 0, 0.08); }

    .btn-skip {
      background: transparent; color: #9ca3af;
      padding: 11px 12px; font-weight: 500;
      text-decoration: underline; text-decoration-color: rgba(156, 163, 175, 0.4);
      text-underline-offset: 3px;
    }
    .btn-skip:hover { color: #6366f1; text-decoration-color: rgba(99, 102, 241, 0.5); }

    .btn-send {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #c7d2fe, #ddd6fe);
      color: #6366f1;
      min-width: 148px;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.12);
    }
    .btn-send.ready {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: #fff;
      box-shadow:
        0 8px 20px -4px rgba(99, 102, 241, 0.55),
        0 2px 4px rgba(0, 0, 0, 0.08),
        0 1px 0 rgba(255, 255, 255, 0.3) inset;
    }
    .btn-send.ready:hover {
      box-shadow:
        0 12px 24px -4px rgba(99, 102, 241, 0.6),
        0 4px 8px rgba(0, 0, 0, 0.1),
        0 1px 0 rgba(255, 255, 255, 0.4) inset;
    }
    .btn-send.ready::after {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%);
      animation: shine 2.2s ease-in-out infinite;
      pointer-events: none;
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .modal {
        background: linear-gradient(180deg, #1c1b28 0%, #161521 100%);
        box-shadow:
          0 40px 80px -20px rgba(0, 0, 0, 0.6),
          0 0 0 1px rgba(255, 255, 255, 0.06) inset;
        color: #e5e7eb;
      }
      .subtitle { color: #9ca3af; }
      .label { color: #a78bfa; }
      .question-text {
        background: rgba(139, 92, 246, 0.09);
        border-color: rgba(139, 92, 246, 0.22);
        color: #d1d5db;
      }
      textarea {
        background: rgba(255, 255, 255, 0.03);
        color: #e5e7eb;
        border-color: rgba(139, 92, 246, 0.25);
      }
      textarea:focus { border-color: #a78bfa; box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.18); }
      textarea::placeholder { color: #6b7280; }
      .btn-cancel { background: rgba(255, 255, 255, 0.06); color: #d1d5db; }
      .btn-cancel:hover { background: rgba(255, 255, 255, 0.12); }
      .btn-send { background: linear-gradient(135deg, #312e81, #4c1d95); color: #c7d2fe; }
      .timer-label { color: #6b7280; }
    }
  `;

  const LOGO_SVG = `
    <svg class="logo" viewBox="0 0 128 128" aria-hidden="true">
      <defs>
        <linearGradient id="mbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#A78BFA"/>
          <stop offset="55%" stop-color="#7C6DF7"/>
          <stop offset="100%" stop-color="#4F46E5"/>
        </linearGradient>
        <radialGradient id="mgloss" cx="28%" cy="22%" r="55%">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.55"/>
          <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="mbar" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#FFFFFF"/>
          <stop offset="100%" stop-color="#DDD6FE"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="120" height="120" rx="26" fill="url(#mbg)"/>
      <rect x="4" y="4" width="120" height="120" rx="26" fill="url(#mgloss)"/>
      <rect x="42" y="34" width="16" height="60" rx="7" fill="url(#mbar)"/>
      <rect x="70" y="34" width="16" height="60" rx="7" fill="url(#mbar)"/>
    </svg>
  `;

  function showThinkingModal(userQuestion) {
    if (openModalHost) openModalHost.remove();

    // Host element lives at document.documentElement, above body —
    // safer against framework re-renders that wipe body children.
    const host = document.createElement('div');
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });
    openModalHost = host;

    // Keyboard isolation at the host level (capture + bubble).
    // Prevents host-site keydown listeners from hearing the user type.
    const stopAll = (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    host.addEventListener('keydown', stopAll, true);
    host.addEventListener('keydown', stopAll, false);
    host.addEventListener('keyup', stopAll, true);
    host.addEventListener('keyup', stopAll, false);
    host.addEventListener('keypress', stopAll, true);
    host.addEventListener('keypress', stopAll, false);

    const style = document.createElement('style');
    style.textContent = MODAL_CSS;
    shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    shadow.appendChild(overlay);

    const truncated = userQuestion.length > 300
      ? userQuestion.substring(0, 300) + '…'
      : userQuestion;

    const pillClass = settings.requireThinking ? 'pill-required' : 'pill-optional';
    const pillText = settings.requireThinking ? t('required') : t('optional');

    const thinkingHTML = settings.showThinkingBox ? `
      <div class="thinking">
        <div class="label">
          ${escapeHtml(t('writeYourThought'))}
          <span class="label-pill ${pillClass}">${escapeHtml(pillText)}</span>
        </div>
        <textarea class="textarea" placeholder="${escapeHtml(t('thinkingPlaceholder'))}"></textarea>
      </div>
    ` : '';

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="header">
          ${LOGO_SVG}
          <h2 class="title">${escapeHtml(t('modalTitle'))}</h2>
          <p class="subtitle">${escapeHtml(t('modalSubtitle'))}</p>
        </div>

        <div class="question">
          <div class="label">${escapeHtml(t('yourQuestion'))}</div>
          <div class="question-text">${escapeHtml(truncated)}</div>
        </div>

        ${thinkingHTML}

        <div class="timer">
          <div class="timer-ring">
            <svg viewBox="0 0 100 100">
              <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#6366f1"/>
                  <stop offset="100%" stop-color="#a855f7"/>
                </linearGradient>
              </defs>
              <circle class="timer-bg" cx="50" cy="50" r="45"/>
              <circle class="timer-progress" cx="50" cy="50" r="45"
                stroke-dasharray="${2 * Math.PI * 45}" stroke-dashoffset="0"/>
            </svg>
            <span class="timer-text">${settings.countdownSeconds}</span>
          </div>
          <div class="timer-label">${escapeHtml(t('timerLabel'))}</div>
        </div>

        <div class="actions">
          <button class="btn btn-skip" style="display:none;">${escapeHtml(t('btnSkip'))}</button>
          <button class="btn btn-cancel">${escapeHtml(t('btnCancel'))}</button>
          <button class="btn btn-send" disabled>
            <span class="btn-send-text">${escapeHtml(t('btnThinking'))}</span>
          </button>
        </div>
      </div>
    `;

    // Inert-lock the rest of the page (prevents focus stealing + clicks).
    const inertTargets = [];
    const applyInert = () => {
      for (const el of Array.from(document.body.children)) {
        if (el === host) continue;
        if (!el.hasAttribute('inert')) {
          el.setAttribute('inert', '');
          inertTargets.push(el);
        }
      }
    };
    const removeInert = () => {
      for (const el of inertTargets) el.removeAttribute('inert');
      inertTargets.length = 0;
    };
    document.documentElement.appendChild(host);
    applyInert();

    const modal = shadow.querySelector('.modal');
    const textarea = shadow.querySelector('textarea');
    const progressCircle = shadow.querySelector('.timer-progress');
    const timerText = shadow.querySelector('.timer-text');
    const sendBtn = shadow.querySelector('.btn-send');
    const sendBtnText = shadow.querySelector('.btn-send-text');
    const cancelBtn = shadow.querySelector('.btn-cancel');
    const skipBtn = shadow.querySelector('.btn-skip');
    const circumference = 2 * Math.PI * 45;

    let countdown = settings.countdownSeconds;
    const thinkingStart = Date.now();

    // Focus trap — if focus ever leaves the shadow root while modal is open,
    // pull it back to the textarea (or to the cancel button if no textarea).
    const focusTarget = () => textarea || cancelBtn;
    const ensureFocus = () => {
      const el = focusTarget();
      if (el) el.focus();
    };
    const focusInHandler = (e) => {
      if (!openModalHost) return;
      const path = e.composedPath ? e.composedPath() : [];
      if (path.includes(host)) return;
      // focus landed outside → pull it back
      setTimeout(ensureFocus, 0);
    };
    document.addEventListener('focusin', focusInHandler, true);
    // Initial focus (deferred so host site's own focus handlers settle first)
    setTimeout(ensureFocus, 50);

    // Countdown
    const timerInterval = setInterval(() => {
      countdown--;
      if (timerText) timerText.textContent = Math.max(0, countdown);
      const progress = (settings.countdownSeconds - countdown) / settings.countdownSeconds;
      progressCircle.style.strokeDashoffset = circumference * (1 - progress);

      if (countdown <= 0) {
        clearInterval(timerInterval);
        timerText.textContent = '✓';
        sendBtn.disabled = false;
        sendBtn.classList.add('ready');
        sendBtnText.textContent = t('btnSend');
        skipBtn.style.display = 'none';
        if (settings.requireThinking && textarea && !textarea.value.trim()) {
          sendBtn.disabled = true;
          sendBtnText.textContent = t('btnWriteFirst');
        }
      }
    }, 1000);

    // Show skip after 3s
    setTimeout(() => {
      if (host.isConnected && countdown > 0) skipBtn.style.display = '';
    }, 3000);

    if (settings.requireThinking && textarea) {
      textarea.addEventListener('input', () => {
        if (countdown <= 0) {
          sendBtn.disabled = !textarea.value.trim();
          sendBtnText.textContent = textarea.value.trim() ? t('btnSend') : t('btnWriteFirst');
        }
      });
    }

    const closeModal = () => {
      clearInterval(timerInterval);
      document.removeEventListener('focusin', focusInHandler, true);
      document.removeEventListener('keydown', escHandler, true);
      removeInert();
      host.remove();
      if (openModalHost === host) openModalHost = null;
    };

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
      pendingSendEvent = null;
    });

    skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const thoughtValue = textarea ? textarea.value : '';
      saveThinkingRecord(userQuestion, thoughtValue, Date.now() - thinkingStart);
      closeModal();
      resumeSend();
    });

    sendBtn.addEventListener('click', (e) => {
      if (sendBtn.disabled) return;
      e.stopPropagation();
      const thoughtValue = textarea ? textarea.value : '';
      saveThinkingRecord(userQuestion, thoughtValue, Date.now() - thinkingStart);
      closeModal();
      resumeSend();
    });

    // ESC to cancel
    const escHandler = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeModal();
      pendingSendEvent = null;
    };
    document.addEventListener('keydown', escHandler, true);

    // Click outside modal (on overlay) does nothing — deliberate, so a stray
    // click cannot abort the user's thinking session.
  }

  async function saveThinkingRecord(question, thinking, durationMs) {
    try {
      const result = await chrome.storage.local.get(['thinkingHistory', 'stats']);
      const history = result.thinkingHistory || [];
      const stats = result.stats || { totalSessions: 0, totalThinkingTime: 0, thoughtsWritten: 0 };
      history.unshift({
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        platform: t(currentPlatform.nameKey),
        question: question.substring(0, 500),
        thinking: thinking.substring(0, 2000),
        durationMs,
      });
      if (history.length > 200) history.pop();
      stats.totalSessions++;
      stats.totalThinkingTime += durationMs;
      if (thinking.trim()) stats.thoughtsWritten++;
      await chrome.storage.local.set({ thinkingHistory: history, stats });
    } catch (e) { /* ignore */ }
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

  init();
})();
