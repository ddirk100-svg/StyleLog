/**
 * POST /api/style-assistant/chat — 내 style_logs RAG + OpenAI
 * Authorization: Bearer <supabase access_token>
 * Body: { "message": "..." }
 */
const {
  sendJson,
  readJsonBody,
  bearerAccessToken,
  createSupabaseForUser,
  buildRagContextBlock,
  fetchUserLogsForRag,
  callOpenAIChat
} = require('../_lib/style-assistant-common.js');

const SYSTEM_PROMPT = `## Role
You are this user's personal fashion stylist on StyleLog (Korea). Help with today's outfit, remixing past looks, and practical style choices for ONE logged-in user.

## Answer priority
1) PRIMARY — Ground answers in the outfit logs supplied in the user message (real saved outfits). Reuse or combine items, colors, and patterns that appear there. When you point to a specific past outfit, include its date or title.
2) FALLBACK — When logs are empty, no log fits the question, or the user still needs broader help (layering, proportions, occasion dress code, color pairing, weather dressing, etc.), respond like a warm, helpful general stylist: friendly, clear, and actionable. Do not fabricate past outfits. Say briefly when advice is general because saved data was missing or not enough.

## Tone and format
- Always write in Korean using polite 해요체. Be concise; use short paragraphs or bullets when it helps.
- Encourage and clarify; avoid lecturing or being cold.
- For readability in the app chat UI, use Markdown lightly: **bold** for key pieces (e.g. 상의, 하의, 아우터), \`-\` bullet lines for multiple tips, and blank lines between sections. Do not use HTML.

## Hard rules
- Never invent specific past outfits, dates, or wardrobe items that are not in the log list.
- In fallback, generic outfit ideas are fine; do not claim the user wore them before.
- Do not push shopping or brand names unless the user asks.
- If there are no logs, honestly say so, suggest saving outfits in StyleLog, and still answer with friendly general guidance if they asked something.
- Never request API keys, passwords, or unrelated private data.`;

module.exports = async function handler(req, res) {
  const method = String(req.method || req.httpMethod || 'GET').toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.end();
    return;
  }

  if (method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed', method });
    return;
  }

  const token = bearerAccessToken(req);
  if (!token) {
    sendJson(res, 401, { ok: false, error: 'auth_required' });
    return;
  }

  const supabase = createSupabaseForUser(req, token);
  if (!supabase) {
    sendJson(res, 503, { ok: false, error: 'supabase_not_configured' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    sendJson(res, 400, { ok: false, error: 'invalid_json' });
    return;
  }

  const message = String(body?.message || '').trim().slice(0, 2000);
  if (!message) {
    sendJson(res, 400, { ok: false, error: 'message_required' });
    return;
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    sendJson(res, 401, { ok: false, error: 'invalid_session' });
    return;
  }

  try {
    const logs = await fetchUserLogsForRag(supabase);
    const context = buildRagContextBlock(logs);
    const reply = await callOpenAIChat([
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `## 내 코디 기록 (최근)\n${context}\n\n## 질문\n${message}`
      }
    ]);

    sendJson(res, 200, {
      ok: true,
      reply,
      logCount: logs.length
    });
  } catch (e) {
    if (e && e.code === 'openai_not_configured') {
      sendJson(res, 503, { ok: false, error: 'openai_not_configured' });
      return;
    }
    if (
      e &&
      (e.code === 'openai_error' ||
        e.code === 'openai_invalid_key' ||
        e.code === 'openai_quota' ||
        e.code === 'openai_rate_limit' ||
        e.code === 'openai_model')
    ) {
      sendJson(res, 502, { ok: false, error: e.code || 'openai_error' });
      return;
    }
    if (e && e.code === 'openai_empty') {
      sendJson(res, 502, { ok: false, error: 'openai_empty' });
      return;
    }
    console.error('style-assistant/chat', e);
    sendJson(res, 500, { ok: false, error: 'assistant_failed' });
  }
};
