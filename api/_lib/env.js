/**
 * 서버리스 공통: process.env 읽기
 */

function envStr(name) {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return '';
  return v.trim();
}

function firstEnvStr(...names) {
  for (const n of names) {
    const v = envStr(n);
    if (v) return v;
  }
  return '';
}

module.exports = { envStr, firstEnvStr };
