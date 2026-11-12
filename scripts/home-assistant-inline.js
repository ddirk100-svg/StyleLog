/**
 * 홈 인라인 AI — 입력 시 패널 확장 (assistant.html 이동 없음)
 */
(function () {
  const root = document.getElementById('homeAiRoot');
  if (!root) return;

  const panel = document.getElementById('homeAiPanel');
  const messagesEl = document.getElementById('homeAiMessages');
  const thinkingEl = document.getElementById('homeAiThinking');
  const thinkingText = document.getElementById('homeAiThinkingText');
  const formCollapsed = document.getElementById('homeAiForm');
  const inputCollapsed = document.getElementById('homeAiInput');
  const formPanel = document.getElementById('homeAiPanelForm');
  const inputPanel = document.getElementById('homeAiPanelInput');
  const closeBtn = document.getElementById('homeAiClose');
  const backdrop = document.getElementById('homeAiBackdrop');
  const sendPanelBtn = formPanel?.querySelector('.home-ai-panel-send');

  let inFlight = false;

  function setThinking(on, text) {
    if (!thinkingEl) return;
    thinkingEl.hidden = !on;
    if (on && thinkingText && text) thinkingText.textContent = text;
  }

  function ensureWelcome() {
    if (!messagesEl || messagesEl.dataset.welcomed === '1') return;
    messagesEl.dataset.welcomed = '1';
    appendMsg('bot', '오늘은 어떤 코디를 해볼까요? 저장해 둔 내 기록만 참고해요.');
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
    if (panel) panel.setAttribute('aria-hidden', 'true');
    if (backdrop) {
      backdrop.classList.remove('is-visible');
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.hidden = true;
    }
    document.body.classList.remove('home-ai-panel-open');
    setThinking(false);
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
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function ask(message) {
    const api = window.StyleLogStyleAssistant;
    if (!api?.chat) throw new Error('AI 모듈을 불러오지 못했어요. 새로고침 후 다시 시도해 주세요.');
    setThinking(true, 'Thinking…');
    await new Promise((r) => setTimeout(r, 180));
    setThinking(true, '내 코디 기록을 살펴보는 중…');
    try {
      return await api.chat(message);
    } finally {
      setThinking(false);
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
})();
