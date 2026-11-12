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

const SYSTEM_PROMPT = `You are StyleLog's personal outfit assistant for ONE user in Korea.
Use ONLY the outfit logs in the context below (their real past outfits). Do not invent outfits not grounded in those logs.
Answer in Korean, concise and practical. Mention date or title when citing a specific past outfit.
If context is empty or nothing matches, say honestly that there is not enough saved data and suggest saving outfits or browsing home — do not make up items.
Never ask for API keys or private data outside the log list.`;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
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
    console.error('style-assistant/chat', e);
    sendJson(res, 500, { ok: false, error: 'assistant_failed' });
  }
};
