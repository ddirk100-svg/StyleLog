(function () {
  const threadEl = document.getElementById('assistantThread');
  const formEl = document.getElementById('assistantForm');
  const inputEl = document.getElementById('assistantInput');
  const sendBtn = document.getElementById('assistantSend');

  function appendBubble(role, text) {
    if (!threadEl) return;
    const div = document.createElement('div');
    div.className =
      role === 'user' ? 'assistant-bubble assistant-bubble--user' : 'assistant-bubble assistant-bubble--bot';
    div.textContent = text;
    threadEl.appendChild(div);
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  async function sendMessage(message) {
    const api = window.StyleLogStyleAssistant;
    if (!api?.chat) {
      throw new Error('AI 모듈을 불러오지 못했어요.');
    }
    return api.chat(message);
  }

  formEl?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = String(inputEl?.value || '').trim();
    if (!msg || sendBtn?.disabled) return;
    appendBubble('user', msg);
    if (inputEl) inputEl.value = '';
    sendBtn.disabled = true;
    try {
      const reply = await sendMessage(msg);
      if (reply) appendBubble('bot', reply);
    } catch (err) {
      appendBubble('bot', err?.message || '오류가 났어요.');
    } finally {
      sendBtn.disabled = false;
      inputEl?.focus();
    }
  });

  document.addEventListener('DOMContentLoaded', async () => {
    if (typeof requireAuth === 'function' && !(await requireAuth())) return;
    appendBubble(
      'bot',
      '안녕하세요. 저장해 둔 내 코디만 보고 추천해요. 오늘 상황이나 날씨를 말해 보세요.'
    );
  });
})();
