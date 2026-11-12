/**
 * POST /api/style-assistant/chat — 공통 클라이언트
 */
(function () {
  const ERROR_LABELS = {
    auth_required: '다시 로그인해 주세요.',
    invalid_session: '로그인이 만료됐어요. 다시 로그인해 주세요.',
    openai_not_configured: 'AI 설정이 준비 중이에요. 잠시 후 다시 시도해 주세요.',
    assistant_failed: 'AI 응답을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
    supabase_not_configured: '서버 설정을 확인 중이에요.',
    message_required: '메시지를 입력해 주세요.',
    method_not_allowed:
      '채팅 API가 POST로 연결되지 않았어요. alpha에 최신 배포가 올라갔는지, 로컬은 npm run dev 인지 확인해 주세요.'
  };

  async function chat(message) {
    const text = String(message || '').trim();
    if (!text) return null;

    const { data } = await supabaseClient.auth.getSession();
    const access = data?.session?.access_token;
    if (!access) {
      window.location.href = 'landing.html';
      return null;
    }

    let res;
    try {
      res = await fetch('/api/style-assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + access
        },
        body: JSON.stringify({ message: text })
      });
    } catch (_) {
      throw new Error('네트워크 오류예요. 연결을 확인해 주세요.');
    }

    const contentType = res.headers.get('content-type') || '';
    let body = {};
    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => ({}));
    } else {
      const raw = await res.text().catch(() => '');
      if (res.status === 404) {
        throw new Error(
          '채팅 API에 연결되지 않았어요. 로컬은 npm run dev, 배포 URL(alpha·stylelog)로 열어 주세요.'
        );
      }
      if (res.status === 405) {
        throw new Error(ERROR_LABELS.method_not_allowed);
      }
      throw new Error(raw.slice(0, 100) || `요청 실패 (HTTP ${res.status})`);
    }

    if (!res.ok) {
      const code = body?.error;
      throw new Error(ERROR_LABELS[code] || (typeof code === 'string' ? code : `요청 실패 (${res.status})`));
    }

    return (
      String(body.reply || '').trim() ||
      '답을 만들지 못했어요. 코디 기록을 더 쌓아 보세요.'
    );
  }

  window.StyleLogStyleAssistant = { chat };
})();
