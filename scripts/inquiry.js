// 고객센터 — 문의 목록 (support_inquiries, 본인 행만)

function escapeInquiryHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function formatInquiryDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderInquiryCard(row) {
    const replyText = row.admin_reply != null ? String(row.admin_reply).trim() : '';
    const answered = replyText.length > 0;
    const dateStr = formatInquiryDate(row.created_at);
    let replyMeta = '';
    if (answered) {
        const repliedIso = row.replied_at || null;
        const updatedIso = row.admin_reply_updated_at || null;
        const firstIso = repliedIso || updatedIso;
        const firstStr = formatInquiryDate(firstIso);
        if (firstStr) {
            const tReplied = repliedIso ? new Date(repliedIso).getTime() : 0;
            const tUpdated = updatedIso ? new Date(updatedIso).getTime() : 0;
            const editedLater = tUpdated > tReplied;
            const updateStr = editedLater ? formatInquiryDate(updatedIso) : '';
            const lineRegistered = `<div class="inquiry-card-reply-meta-line">답변 등록 <time datetime="${escapeInquiryHtml(firstIso)}">${escapeInquiryHtml(firstStr)}</time></div>`;
            const lineEdited = editedLater && updateStr
                ? `<div class="inquiry-card-reply-meta-line">마지막 수정 <time datetime="${escapeInquiryHtml(updatedIso)}">${escapeInquiryHtml(updateStr)}</time></div>`
                : '';
            replyMeta = `<div class="inquiry-card-reply-meta">${lineRegistered}${lineEdited}</div>`;
        }
    }

    const replyBlock = answered
        ? `<div class="inquiry-card-reply">
            <span class="inquiry-card-reply-label">답변</span>
            <p class="inquiry-card-reply-text">${escapeInquiryHtml(replyText)}</p>
            ${replyMeta}
           </div>`
        : '<p class="inquiry-card-pending">답변 준비 중입니다.</p>';

    return `<li class="inquiry-card">
        <div class="inquiry-card-head">
            <span class="inquiry-card-badge ${answered ? 'is-answered' : 'is-open'}">${answered ? '답변 완료' : '접수'}</span>
            <time class="inquiry-card-date" datetime="${escapeInquiryHtml(row.created_at)}">${escapeInquiryHtml(dateStr)}</time>
        </div>
        <h3 class="inquiry-card-title">${escapeInquiryHtml(row.title)}</h3>
        <p class="inquiry-card-body">${escapeInquiryHtml(row.body)}</p>
        ${replyBlock}
    </li>`;
}

async function loadInquiries() {
    const listEl = document.getElementById('inquiryList');
    const emptyEl = document.getElementById('inquiryEmptyState');
    if (!listEl || !emptyEl) return;

    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
        emptyEl.querySelector('.placeholder-text').textContent = '연결을 확인할 수 없습니다.';
        emptyEl.querySelector('.placeholder-hint').textContent = 'config.js / Supabase 설정을 확인해 주세요.';
        emptyEl.hidden = false;
        listEl.hidden = true;
        return;
    }

    const { data, error } = await supabaseClient
        .from('support_inquiries')
        .select('id, title, body, status, admin_reply, replied_at, admin_reply_updated_at, created_at')
        .order('created_at', { ascending: false });

    const textEl = emptyEl.querySelector('.placeholder-text');
    const hintEl = emptyEl.querySelector('.placeholder-hint');

    if (error) {
        console.error('문의 목록 오류:', error);
        textEl.textContent = '목록을 불러오지 못했습니다.';
        hintEl.textContent = getInquiryListErrorMessage(error);
        emptyEl.hidden = false;
        listEl.hidden = true;
        listEl.innerHTML = '';
        return;
    }

    if (!data || data.length === 0) {
        textEl.textContent = '문의 내역이 없습니다.';
        hintEl.textContent = '문의 작성하기 버튼으로 문의를 등록해 주세요.';
        emptyEl.hidden = false;
        listEl.hidden = true;
        listEl.innerHTML = '';
        return;
    }

    emptyEl.hidden = true;
    listEl.hidden = false;
    listEl.innerHTML = data.map(renderInquiryCard).join('');
}

async function initPage() {
    await loadInquiries();
}
