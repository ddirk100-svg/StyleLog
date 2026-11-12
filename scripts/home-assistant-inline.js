/**
 * 홈 인라인 AI — 바텀시트 채팅 (assistant.html 이동 없음)
 */
(function () {
  const root = document.getElementById('homeAiRoot');
  if (!root) return;

  const panel = document.getElementById('homeAiPanel');
  const messagesEl = document.getElementById('homeAiMessages');
  const formCollapsed = document.getElementById('homeAiForm');
  const inputCollapsed = document.getElementById('homeAiInput');
  const formPanel = document.getElementById('homeAiPanelForm');
  const inputPanel = document.getElementById('homeAiPanelInput');
  const closeBtn = document.getElementById('homeAiClose');
  const backdrop = document.getElementById('homeAiBackdrop');
  const handle = document.getElementById('homeAiHandle');
  const sendPanelBtn = formPanel?.querySelector('.home-ai-panel-send');

  let inFlight = false;
  let thinkingRow = null;

  function scrollMessagesToEnd() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function removeThinking() {
    if (thinkingRow?.parentNode) thinkingRow.parentNode.removeChild(thinkingRow);
    thinkingRow = null;
  }

  function showThinking(label) {
    if (!messagesEl) return;
    removeThinking();
    const row = document.createElement('div');
    row.className = 'home-ai-msg home-ai-msg--bot home-ai-msg--thinking';
    row.setAttribute('aria-busy', 'true');
    const bubble = document.createElement('div');
    bubble.className = 'home-ai-msg-bubble home-ai-msg-bubble--thinking';
    bubble.innerHTML =
      '<span class="home-ai-thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
      `<span class="home-ai-thinking-label">${label || '생각하는 중…'}</span>`;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    thinkingRow = row;
    scrollMessagesToEnd();
  }

  function ensureWelcome() {
    if (!messagesEl || messagesEl.dataset.welcomed === '1') return;
    messagesEl.dataset.welcomed = '1';
    appendMsg(
      'bot',
      '오늘은 어떤 코디를 해볼까요?\n저장해 둔 내 기록만 참고해요.'
    );
  }

  function expand() {
    root.classList.add('is-expanded');
    if (panel) panel.setAttribute('aria-hidden', 'false');
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.classList.add('is-visible');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('home-ai-panel-open');
    ensureWelcome();
    if (inputPanel && inputCollapsed) inputPanel.value = inputCollapsed.value;
    inputPanel?.focus();
  }

  function collapse() {
    root.classList.remove('is-expanded');
    if (panel) {
      panel.classList.remove('is-dragging');
      panel.style.transition = '';
      panel.style.transform = '';
      panel.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.classList.remove('is-visible');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.hidden = true;
    }
    document.body.classList.remove('home-ai-panel-open');
    removeThinking();
  }

  function appendMsg(role, text) {
    if (!messagesEl) return;
    const row = document.createElement('div');
    row.className = role === 'user' ? 'home-ai-msg home-ai-msg--user' : 'home-ai-msg home-ai-msg--bot';
    const bubble = document.createElement('div');
    bubble.className = 'home-ai-msg-bubble';
    bubble.textContent = text;
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollMessagesToEnd();
  }

  async function ask(message) {
    const api = window.StyleLogStyleAssistant;
    if (!api?.chat) throw new Error('AI 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
    showThinking('Thinking…');
    await new Promise((r) => setTimeout(r, 220));
    if (thinkingRow) {
      const label = thinkingRow.querySelector('.home-ai-thinking-label');
      if (label) label.textContent = '내 코디 기록을 살펴보는 중…';
    }
    try {
      return await api.chat(message);
    } finally {
      removeThinking();
    }
  }

  async function handleSend(raw) {
    const message = String(raw || '').trim();
    if (!message || inFlight) return;
    inFlight = true;
    if (sendPanelBtn) sendPanelBtn.disabled = true;
    expand();
    if (inputCollapsed) inputCollapsed.value = '';
    if (inputPanel) inputPanel.value = '';
    appendMsg('user', message);
    try {
      const reply = await ask(message);
      if (reply) appendMsg('bot', reply);
    } catch (e) {
      appendMsg('bot', e?.message || '오류가 났어요.');
    } finally {
      inFlight = false;
      if (sendPanelBtn) sendPanelBtn.disabled = false;
      inputPanel?.focus();
    }
  }

  function bindSheetSwipeDismiss() {
    if (!panel || !handle || panel.dataset.swipeBound === '1') return;
    panel.dataset.swipeBound = '1';
    const DISMISS_PX = 88;
    let startY = 0;
    let dragY = 0;
    let dragging = false;
    let pointerId = null;

    handle.addEventListener('pointerdown', (e) => {
      if (!root.classList.contains('is-expanded')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      dragY = 0;
      panel.classList.add('is-dragging');
      panel.style.transition = 'none';
      try {
        handle.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragY = Math.max(0, e.clientY - startY);
      panel.style.transform = `translate(-50%, ${dragY}px)`;
    });

    const endDrag = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      panel.classList.remove('is-dragging');
      const shouldClose = dragY > DISMISS_PX;
      panel.style.transition = 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)';
      if (shouldClose) {
        panel.style.transform = 'translate(-50%, 110%)';
        window.setTimeout(collapse, 280);
        return;
      }
      panel.style.transform = 'translate(-50%, 0)';
      window.setTimeout(() => {
        panel.style.transition = '';
        panel.style.transform = '';
      }, 300);
    };

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  inputCollapsed?.addEventListener('focus', expand);

  formCollapsed?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSend(inputCollapsed?.value);
  });

  formPanel?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSend(inputPanel?.value);
  });

  closeBtn?.addEventListener('click', collapse);
  backdrop?.addEventListener('click', collapse);

  inputPanel?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!inFlight) formPanel?.requestSubmit();
    }
  });

  bindSheetSwipeDismiss();
})();
