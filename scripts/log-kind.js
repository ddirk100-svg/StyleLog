/**
 * 4.0V — style_logs.log_kind 및 레퍼런스 필드 상수
 */
(function (global) {
  const LOG_KIND_MY_OUTFIT = 'my_outfit';
  const LOG_KIND_REFERENCE = 'reference';

  const LOG_KIND_LABELS = Object.freeze({
    [LOG_KIND_MY_OUTFIT]: '내 착장',
    [LOG_KIND_REFERENCE]: '레퍼런스'
  });

  function normalizeLogKind(raw) {
    const v = String(raw || '').trim().toLowerCase();
    if (v === LOG_KIND_REFERENCE) return LOG_KIND_REFERENCE;
    return LOG_KIND_MY_OUTFIT;
  }

  function logKindLabel(kind) {
    const k = normalizeLogKind(kind);
    return LOG_KIND_LABELS[k] || LOG_KIND_LABELS[LOG_KIND_MY_OUTFIT];
  }

  function isLogKindColumnError(error) {
    if (!error) return false;
    const parts = [];
    if (typeof error.message === 'string') parts.push(error.message);
    if (typeof error.details === 'string') parts.push(error.details);
    if (typeof error.hint === 'string') parts.push(error.hint);
    if (error.code != null) parts.push(String(error.code));
    const flat = parts.join(' ').toLowerCase();
    if (
      !/\blog_kind\b/.test(flat) &&
      !/\breference_source_url\b/.test(flat) &&
      !/\bscrap_group\b/.test(flat) &&
      !/\bsource_reference_id\b/.test(flat)
    ) {
      return false;
    }
    return /does not exist|schema cache|could not find|42703|pgrst204/.test(flat);
  }

  /** http·https URL 만 허용 — 외부 링크용 */
  function safeExternalUrl(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      const proto = u.protocol.toLowerCase();
      if (proto !== 'http:' && proto !== 'https:') return '';
      return u.href;
    } catch (_) {
      return '';
    }
  }

  global.LOG_KIND_MY_OUTFIT = LOG_KIND_MY_OUTFIT;
  global.LOG_KIND_REFERENCE = LOG_KIND_REFERENCE;
  global.LOG_KIND_LABELS = LOG_KIND_LABELS;
  global.normalizeLogKind = normalizeLogKind;
  global.logKindLabel = logKindLabel;
  global.isLogKindColumnError = isLogKindColumnError;
  global.safeExternalUrl = safeExternalUrl;
})(typeof window !== 'undefined' ? window : globalThis);
