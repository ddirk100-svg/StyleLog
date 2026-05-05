/**
 * 고객 문의 INSERT 시 어드민 알림 메일.
 */

const { sendResendEmail } = require('./resend-email.js');
const { adminInquiriesPageUrl } = require('./stylelog-public-url.js');
const { escapeHtml } = require('./mail-text.js');

function truncate(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

/**
 * @param {{ to: string|string[]; title: string; bodyPreview: string; userEmail?: string; host?: string }} opts
 * @returns {Promise<{ ok: boolean; skipped?: string; error?: string }>}
 */
async function sendAdminNewInquiryEmail(opts) {
  const title = opts && opts.title != null ? String(opts.title).trim() : '';
  const preview = truncate(opts && opts.bodyPreview, 400);
  const userEmail =
    opts && opts.userEmail != null ? String(opts.userEmail).trim() : '';
  const titleLine = title || '(제목 없음)';

  const adminUrl = adminInquiriesPageUrl();
  const subject = `[StyleLog 관리자] 새 고객 문의: ${titleLine}`;

  let text =
    '새 고객 문의가 등록되었습니다.\n\n' +
    `제목: ${titleLine}\n`;
  if (userEmail) text += `작성자 이메일: ${userEmail}\n`;
  text += '\n본문 미리보기:\n' + (preview || '(내용 없음)') + '\n';
  if (adminUrl) {
    text += '\n관리자 문의 목록:\n' + adminUrl + '\n';
  } else {
    text += '\n관리자 사이트의 고객 문의 화면에서 확인해 주세요.\n';
  }

  let html = '<p>새 고객 문의가 등록되었습니다.</p>';
  html += `<p><strong>제목:</strong> ${escapeHtml(titleLine)}</p>`;
  if (userEmail) html += `<p><strong>작성자 이메일:</strong> ${escapeHtml(userEmail)}</p>`;
  html += `<p><strong>본문 미리보기</strong></p><p>${escapeHtml(preview || '(내용 없음)')}</p>`;
  if (adminUrl) {
    const u = escapeHtml(adminUrl);
    html += `<p><a href="${u}">관리자 문의 목록 열기</a></p>`;
  } else {
    html += '<p>관리자 사이트의 고객 문의 화면에서 확인해 주세요.</p>';
  }

  return sendResendEmail({
    to: opts && opts.to,
    subject,
    text,
    html,
    host: opts && opts.host
  });
}

module.exports = { sendAdminNewInquiryEmail };
