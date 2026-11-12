/**
 * 5.0 — 코디 어시스턴트: 사용자 JWT + anon Supabase, OpenAI 호출
 */
const { createClient } = require('@supabase/supabase-js');
const {
  getHost,
  useTestDatabase,
  resolveSupabaseEnv,
  sendJson,
  readJsonBody
} = require('./admin-common.js');
const { envStr, firstEnvStr } = require('./env.js');

/** scripts/config.js 와 동일(공개 anon) */
const DEFAULT_DEV_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvZXVycnVndXp4aXBldnBwbmtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTY0MDcsImV4cCI6MjA4MjM5MjQwN30.JGkCsUGdiW4NKIcrM2dOVV0AqiFX4IwfVCsz3sC6sEM';
const DEFAULT_PROD_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bXN6aWJpd29qenJ0eGhpZXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4MTY5MTksImV4cCI6MjA4MjM5MjkxOX0.9TLof1cyqSkZ33Y-stvBaqQ3iT9lpoMnljsk-XPMBHM';

const TPO_LABELS = {
  work: '회사',
  daily: '일상/데이트',
  travel: '여행',
  workout: '운동',
  guest: '경조사'
};

const WEATHER_FIT_LABELS = { cold: '추움', good: '적당', hot: '더움' };

function resolveSupabaseAnonEnv(host) {
  const test = useTestDatabase(host);
  const { url } = resolveSupabaseEnv(host);
  const anon = test
    ? firstEnvStr('SUPABASE_ANON_KEY_DEV', 'SUPABASE_ANON_KEY') || DEFAULT_DEV_ANON
    : firstEnvStr('SUPABASE_ANON_KEY_PROD', 'SUPABASE_ANON_KEY') || DEFAULT_PROD_ANON;
  return { url, anon, test };
}

function bearerAccessToken(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

function createSupabaseForUser(req, accessToken) {
  if (!accessToken) return null;
  const host = getHost(req);
  const { url, anon } = resolveSupabaseAnonEnv(host);
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isReferenceRow(row) {
  const k = String(row?.log_kind || 'my_outfit').toLowerCase();
  return k === 'reference';
}

function formatItemLine(itemsRaw) {
  if (!itemsRaw) return '';
  let arr = itemsRaw;
  if (typeof arr === 'string') {
    try {
      arr = JSON.parse(arr);
    } catch {
      return '';
    }
  }
  if (!Array.isArray(arr)) return '';
  return arr
    .map((it) => {
      if (!it || typeof it !== 'object') return '';
      const c = String(it.category || '').trim();
      const v = String(it.value || '').trim();
      if (!c && !v) return '';
      return c && v ? `${c}:${v}` : v || c;
    })
    .filter(Boolean)
    .join(', ');
}

function buildRagContextBlock(logs) {
  const rows = (logs || []).filter((r) => !isReferenceRow(r)).slice(0, 40);
  if (!rows.length) {
    return '(저장된 내 착장 기록이 없습니다.)';
  }
  return rows
    .map((log) => {
      const tpo = Array.isArray(log.tpo)
        ? log.tpo.map((v) => TPO_LABELS[v] || v).join('/')
        : '';
      const fit = log.weather_fit ? WEATHER_FIT_LABELS[log.weather_fit] || log.weather_fit : '';
      const temp =
        log.weather_temp_min != null && log.weather_temp_max != null
          ? `${log.weather_temp_min}~${log.weather_temp_max}°C`
          : '';
      const items = formatItemLine(log.items);
      const fav = log.is_favorite ? '즐겨찾기' : '';
      const title = String(log.title || '').trim() || '(제목 없음)';
      const memo = String(log.content || '').trim().slice(0, 120);
      const parts = [
        `id=${log.id}`,
        `날짜=${log.date}`,
        title,
        [temp, fit].filter(Boolean).join(' '),
        tpo ? `상황=${tpo}` : '',
        items ? `착장=${items}` : '',
        fav,
        memo ? `메모=${memo}` : ''
      ].filter(Boolean);
      return `- ${parts.join(' | ')}`;
    })
    .join('\n');
}

async function fetchUserLogsForRag(supabase) {
  const { data, error } = await supabase
    .from('style_logs')
    .select(
      'id,date,title,content,weather_fit,weather_temp_min,weather_temp_max,tpo,items,is_favorite,log_kind'
    )
    .order('date', { ascending: false })
    .limit(60);
  if (error) throw error;
  return (data || []).filter((r) => !isReferenceRow(r));
}

async function callOpenAIChat(messages) {
  const key = envStr('OPENAI_API_KEY');
  if (!key) {
    const err = new Error('openai_not_configured');
    err.code = 'openai_not_configured';
    throw err;
  }
  const model = firstEnvStr('OPENAI_MODEL') || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 900
    })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || 'openai_error');
    err.code = 'openai_error';
    err.status = res.status;
    throw err;
  }
  const text = body?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    const err = new Error('openai_empty');
    err.code = 'openai_empty';
    throw err;
  }
  return text.trim();
}

module.exports = {
  sendJson,
  readJsonBody,
  bearerAccessToken,
  createSupabaseForUser,
  resolveSupabaseAnonEnv,
  buildRagContextBlock,
  fetchUserLogsForRag,
  callOpenAIChat
};
