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

  async function getAccessToken() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data?.session?.access_token) return null;
    return data.session.access_token;
  }

  async function sendMessage(message) {
    const token = await getAccessToken();
    if (!token) {
      window.location.href = 'login.html?redirect=' + encodeURIComponent('assistant.html');
      return;
    }
    const res = await fetch('/api/style-assistant/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ message })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === 'openai_not_configured') {
        throw new Error('AI 설정이 아직 완료되지 않았어요. 잠시 후 다시 시도해 주세요.');
      }
      if (data.error === 'auth_required' || data.error === 'invalid_session') {
        window.location.href = 'login.html?redirect=' + encodeURIComponent('assistant.html');
        return;
      }
      throw new Error(data.error || '요청에 실패했어요.');
    }
    return String(data.reply || '').trim() || '답을 만들지 못했어요. 홈에서 기록을 더 쌓아 보세요.';
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
