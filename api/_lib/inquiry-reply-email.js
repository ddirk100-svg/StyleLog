/**
 * 문의 첫 답변 안내 메일 (Resend).
 * Vercel: RESEND_API_KEY, RESEND_FROM 필수. 선택: STYLELOG_PUBLIC_URL 등 → inquiry.html 링크.
 */

const { sendResendEmail, isResendConfigured } = require('./resend-email.js');
const { inquiryPageUrl } = require('./stylelog-public-url.js');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {{ to: string; title: string }} opts
 * @returns {Promise<{ ok: boolean; skipped?: string; error?: string }>}
 */
async function sendInquiryFirstReplyEmail(opts) {
  const to = (opts && opts.to ? String(opts.to) : '').trim().toLowerCase();
  const title = opts && opts.title != null ? String(opts.title).trim() : '';

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, skipped: 'invalid_recipient' };
  }

  const pageUrl = inquiryPageUrl();
  const subject = '[StyleLog] 문의하신 글에 답변이 등록되었습니다';
  const titleLine = title || '(제목 없음)';

  let text =
    '안녕하세요, StyleLog입니다.\n\n' +
    `「${titleLine}」 문의에 답변이 등록되었습니다.\n`;
  if (pageUrl) {
    text += '\n아래 링크에서 전체 답변을 확인하실 수 있습니다.\n' + pageUrl + '\n';
  } else {
    text += '\nStyleLog 사이트의 문의 내역 페이지에서 전체 답변을 확인해 주세요.\n';
  }
  text += '\n감사합니다.';

  let html =
    '<p>안녕하세요, StyleLog입니다.</p>' +
    `<p><strong>「${escapeHtml(titleLine)}」</strong> 문의에 답변이 등록되었습니다.</p>`;
  if (pageUrl) {
    const u = escapeHtml(pageUrl);
    html += `<p><a href="${u}">문의 내역 보기</a></p>`;
  } else {
    html += '<p>StyleLog 사이트의 문의 내역 페이지에서 전체 답변을 확인해 주세요.</p>';
  }
  html += '<p>감사합니다.</p>';

  return sendResendEmail({ to, subject, text, html });
}

module.exports = {
  sendInquiryFirstReplyEmail,
  isInquiryReplyEmailConfigured: isResendConfigured
};
