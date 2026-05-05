/**
 * 메일·링크용 공개 사이트 URL (환경 변수 우선).
 */

const { firstEnvStr } = require('./env.js');

/** 루트 URL, 끝 슬래시 제거. 비었을 수 있음. */
function publicSiteOrigin() {
  return firstEnvStr(
    'STYLELOG_PUBLIC_URL',
    'PUBLIC_SITE_URL',
    'NEXT_PUBLIC_SITE_URL',
    'VERCEL_URL'
  ).replace(/\/+$/, '');
}

function withOrigin(path) {
  const root = publicSiteOrigin();
  if (!root) return '';
  const p = path.startsWith('/') ? path : `/${path}`;
  if (/^https?:\/\//i.test(root)) return `${root}${p}`;
  return `https://${root.replace(/^\/+/, '')}${p}`;
}

function inquiryPageUrl() {
  return withOrigin('/inquiry.html');
}

function adminInquiriesPageUrl() {
  return withOrigin('/admin/inquiries.html');
}

module.exports = {
  publicSiteOrigin,
  inquiryPageUrl,
  adminInquiriesPageUrl
};
