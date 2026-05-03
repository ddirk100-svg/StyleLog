/**
 * 개선·불편 의견: 모달 폼 → Supabase user_feedback
 * 전제: docs/supabase/user_feedback.sql 적용됨
 */

function getFeedbackSubmitErrorMessage(err) {
  const code = err?.code;
  const raw = String(err?.message || '').toLowerCase();
  if (
    code === 'PGRST204' ||
    raw.includes('schema cache') ||
    raw.includes('could not find the table')
  ) {
    return [
      '의견을 저장하는 DB 테이블이 아직 없어요.',
      'Supabase 프로젝트(지금 앱이 연결된 그 DB)에서 SQL Editor를 열고,',
      'docs/supabase/user_feedback.sql 내용을 실행한 뒤 다시 보내 주세요.'
    ].join('\n');
  }
  return `전송에 실패했습니다.${err?.message ? '\n\n' + err.message : ''}`;
}

async function openFeedbackModal() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    await showAlert('연결 설정을 확인해 주세요.');
    return;
  }

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    await showAlert('로그인 후 이용해 주세요.');
    return;
  }

  document.querySelectorAll('.menu-popup.active').forEach((m) => {
    m.classList.remove('active');
  });
  document.body.style.overflow = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'stylelog-dialog-backdrop stylelog-feedback-backdrop';
  backdrop.innerHTML = `
    <div class="stylelog-dialog stylelog-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-dialog-title">
      <div class="stylelog-dialog-body stylelog-feedback-body">
        <h2 class="stylelog-feedback-title" id="feedback-dialog-title">의견 보내기</h2>
        <p class="stylelog-feedback-desc">불편한 점이나 개선 아이디어를 남겨 주세요. 서비스에 반영하는 데 참고합니다.</p>
        <div class="stylelog-feedback-field">
          <span class="stylelog-feedback-label" id="feedback-type-label">유형</span>
          <input type="hidden" id="feedbackCategory" value="idea">
          <div class="stylelog-feedback-type-list" role="radiogroup" aria-labelledby="feedback-type-label">
            <button type="button" class="stylelog-feedback-type-option is-selected" role="radio" aria-checked="true" data-value="idea">
              <span class="stylelog-feedback-type-check" aria-hidden="true"></span>
              <span class="stylelog-feedback-type-text">
                <span class="stylelog-feedback-type-title">개선·기능 제안</span>
                <span class="stylelog-feedback-type-desc">새 기능·아이디어·개선 요청</span>
              </span>
            </button>
            <button type="button" class="stylelog-feedback-type-option" role="radio" aria-checked="false" data-value="bug">
              <span class="stylelog-feedback-type-check" aria-hidden="true"></span>
              <span class="stylelog-feedback-type-text">
                <span class="stylelog-feedback-type-title">불편·오류</span>
                <span class="stylelog-feedback-type-desc">버그, 잘못된 동작, 사용 불편</span>
              </span>
            </button>
            <button type="button" class="stylelog-feedback-type-option" role="radio" aria-checked="false" data-value="other">
              <span class="stylelog-feedback-type-check" aria-hidden="true"></span>
              <span class="stylelog-feedback-type-text">
                <span class="stylelog-feedback-type-title">기타</span>
                <span class="stylelog-feedback-type-desc">위에 해당하지 않는 내용</span>
              </span>
            </button>
          </div>
        </div>
        <label class="stylelog-feedback-field">
          <span class="stylelog-feedback-label">제목</span>
          <input type="text" class="stylelog-dialog-input stylelog-feedback-input" id="feedbackTitle" maxlength="120" placeholder="한 줄로 요약해 주세요" autocomplete="off">
        </label>
        <label class="stylelog-feedback-field">
          <span class="stylelog-feedback-label">내용</span>
          <textarea class="stylelog-feedback-textarea" id="feedbackBody" rows="5" maxlength="4000" placeholder="자세히 적어 주시면 큰 도움이 됩니다"></textarea>
        </label>
      </div>
      <div class="stylelog-dialog-actions">
        <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-cancel" id="feedbackCancel">닫기</button>
        <button type="button" class="stylelog-dialog-btn stylelog-dialog-btn-confirm" id="feedbackSubmit">보내기</button>
      </div>
    </div>
  `;

  const titleEl = backdrop.querySelector('#feedbackTitle');
  const bodyEl = backdrop.querySelector('#feedbackBody');
  const categoryHidden = backdrop.querySelector('#feedbackCategory');
  const typeOptionBtns = backdrop.querySelectorAll('.stylelog-feedback-type-option');
  const submitBtn = backdrop.querySelector('#feedbackSubmit');
  const cancelBtn = backdrop.querySelector('#feedbackCancel');

  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    document.body.style.overflow = '';
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  const validate = () => {
    const t = titleEl.value.trim();
    const b = bodyEl.value.trim();
    submitBtn.disabled = !(t.length > 0 && b.length > 0);
  };

  titleEl.addEventListener('input', validate);
  bodyEl.addEventListener('input', validate);
  validate();

  typeOptionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value');
      categoryHidden.value = val || 'idea';
      typeOptionBtns.forEach((b) => {
        b.classList.toggle('is-selected', b === btn);
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
    });
  });

  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  submitBtn.addEventListener('click', async () => {
    const title = titleEl.value.trim();
    const body = bodyEl.value.trim();
    const category = categoryHidden.value || 'idea';
    if (!title || !body) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중…';

    try {
      const { error } = await supabaseClient.from('user_feedback').insert({
        user_id: user.id,
        category,
        title,
        body
      });

      if (error) throw error;
      close();
      await showAlert('소중한 의견 감사합니다.');
    } catch (err) {
      console.error(err);
      submitBtn.disabled = false;
      submitBtn.textContent = '보내기';
      await showAlert(getFeedbackSubmitErrorMessage(err));
    }
  });

  document.addEventListener('keydown', onKey);
  document.body.style.overflow = 'hidden';
  document.body.appendChild(backdrop);
  titleEl.focus();
}

function initFeedbackTriggers(root = document) {
  root.querySelectorAll('[data-open-feedback]').forEach((el) => {
    if (el.dataset.feedbackBound === '1') return;
    el.dataset.feedbackBound = '1';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openFeedbackModal();
    });
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => initFeedbackTriggers());
}
