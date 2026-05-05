/**
 * 관리자 목록 행 상세 — 중앙 모달, 이전·다음 탐색
 * 페이지에 #admin-detail-modal 마크업 필요
 */
(function () {
  let active = null;
  let onKeydown = null;

  function $(id) {
    return document.getElementById(id);
  }

  function close() {
    const modal = $('admin-detail-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('admin-detail-modal-open');
    if (onKeydown) {
      document.removeEventListener('keydown', onKeydown);
      onKeydown = null;
    }
    active = null;
  }

  function sync() {
    if (!active) return;
    const titleEl = $('admin-detail-modal-title');
    const bodyEl = $('admin-detail-modal-body');
    const prevEl = $('admin-detail-modal-prev');
    const nextEl = $('admin-detail-modal-next');
    if (!titleEl || !bodyEl || !prevEl || !nextEl) return;

    const { index, length, getTitle, renderBody, afterRender, onIndexChange } = active;
    titleEl.textContent = getTitle(index);
    bodyEl.innerHTML = renderBody(index);
    afterRender?.(index);
    prevEl.disabled = index <= 0;
    nextEl.disabled = index >= length - 1;
    onIndexChange?.(index);
  }

  function open(config) {
    if (onKeydown) {
      document.removeEventListener('keydown', onKeydown);
      onKeydown = null;
    }

    const modal = $('admin-detail-modal');
    if (!modal) return;

    active = {
      index: config.index,
      length: Math.max(0, config.length | 0),
      getTitle: config.getTitle || (() => '상세'),
      renderBody: config.renderBody,
      afterRender: config.afterRender,
      onIndexChange: config.onIndexChange
    };

    modal.hidden = false;
    document.body.classList.add('admin-detail-modal-open');
    sync();

    const prevEl = $('admin-detail-modal-prev');
    const nextEl = $('admin-detail-modal-next');
    prevEl.onclick = () => {
      if (active && active.index > 0) {
        active.index--;
        sync();
      }
    };
    nextEl.onclick = () => {
      if (active && active.index < active.length - 1) {
        active.index++;
        sync();
      }
    };

    modal.querySelectorAll('[data-admin-detail-close]').forEach((el) => {
      el.onclick = close;
    });

    onKeydown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeydown);
  }

  function getActiveIndex() {
    return active ? active.index : -1;
  }

  globalThis.AdminDetailModal = { open, close, sync, getActiveIndex };
})();
