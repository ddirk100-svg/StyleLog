/**
 * 트랜잭션 메일용 텍스트·수신자 정규화
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 메일 HTML 본문·속성용 이스케이프 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 환경 변수 한 덩어리 또는 배열 → 유효한 수신 주소 목록 (소문자·중복 제거)
 * @param {string|string[]|undefined|null} input
 * @returns {string[]}
 */
function normalizeRecipientList(input) {
  const parts = Array.isArray(input)
    ? input.flatMap((x) => String(x || '').split(/[,;]+/))
    : String(input || '').split(/[,;]+/);
  return [
    ...new Set(
      parts.map((s) => s.trim().toLowerCase()).filter((s) => EMAIL_RE.test(s))
    )
  ];
}

module.exports = { escapeHtml, normalizeRecipientList, EMAIL_RE };
