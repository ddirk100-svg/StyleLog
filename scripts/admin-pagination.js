/**
 * 관리자 목록: 숫자 페이지 + 이전/다음 (total 미상 시 다음 페이지만 확장)
 */
(function (global) {
  function buildPageSlots(page, totalPages) {
    const max = 7;
    if (totalPages <= max) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const slots = [];
    const half = Math.floor(max / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);

    if (start > 1) {
      slots.push(1);
      if (start > 2) slots.push('…');
    }
    for (let i = start; i <= end; i++) slots.push(i);
    if (end < totalPages) {
      if (end < totalPages - 1) slots.push('…');
      slots.push(totalPages);
    }
    return slots;
  }

  /**
   * @param {HTMLElement|null} el
   * @param {{ page:number, perPage:number, total:number|null|undefined, itemCount:number, onPage:(n:number)=>void }} opts
   */
  function render(el, opts) {
    const { page, perPage, total, itemCount, onPage } = opts;
    if (!el || typeof onPage !== 'function') return;

    const hasPrev = page > 1;
    const totalKnown = typeof total === 'number';
    const hasNext = totalKnown
      ? total > 0 && page * perPage < total
      : itemCount >= perPage;

    let totalPages;
    if (totalKnown && total <= 0) {
      totalPages = 1;
    } else if (totalKnown && total > 0) {
      totalPages = Math.max(1, Math.ceil(total / perPage));
    } else {
      totalPages = Math.max(page, hasNext ? page + 1 : page);
    }

    const slots = buildPageSlots(page, totalPages);

    el.className = 'admin-pagination';
    el.setAttribute('aria-label', '페이지');
    el.replaceChildren();

    const addBtn = (label, targetPage, opt) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'admin-page-btn' + (opt && opt.current ? ' is-current' : '');
      b.textContent = label;
      if (opt && opt.disabled) {
        b.disabled = true;
      } else if (targetPage != null) {
        b.addEventListener('click', () => onPage(targetPage));
      }
      el.appendChild(b);
    };

    addBtn('이전', page - 1, { disabled: !hasPrev });

    for (const s of slots) {
      if (s === '…') {
        const span = document.createElement('span');
        span.className = 'admin-page-ellipsis';
        span.setAttribute('aria-hidden', 'true');
        span.textContent = '…';
        el.appendChild(span);
      } else {
        addBtn(String(s), s, { current: s === page });
      }
    }

    addBtn('다음', page + 1, { disabled: !hasNext });
  }

  global.AdminPagination = { render };
})(globalThis);
