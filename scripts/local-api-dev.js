/**
 * Vercel 로그인 없이 로컬에서 정적 파일 + /api/admin/* 서버리스 핸들러 실행.
 * .env.local 을 process.env 에 로드합니다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8'
};

function loadEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

function safeResolveFile(urlPath) {
  let p = urlPath.split('?')[0];
  if (p === '/') p = '/landing.html';
  const rel = p.replace(/^\/+/, '').replace(/\\/g, '/');
  if (!rel || rel.includes('..') || rel.startsWith('api/') || rel.includes('/api/')) {
    return null;
  }
  if (/^\.env/i.test(rel) || rel.startsWith('.git/') || rel.includes('node_modules')) {
    return null;
  }
  const abs = path.normalize(path.join(ROOT, rel));
  if (!abs.startsWith(ROOT)) return null;
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  return null;
}

/** 로컬에서는 관리자 API만 노출 (웹훅·기타 serverless는 Vercel에서만). */
function apiHandlerPath(urlPath) {
  const p = urlPath.split('?')[0];
  if (!p.startsWith('/api/admin/')) return null;
  const rel = p.slice('/api/'.length).replace(/\/$/, '');
  if (!rel || rel.includes('..') || rel.includes('\\')) return null;
  const file = path.join(ROOT, 'api', `${rel}.js`);
  if (!fs.existsSync(file)) return null;
  return file;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
}

loadEnvLocal();

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  let urlPath = req.url || '/';
  try {
    const u = new URL(urlPath, `http://${host}`);
    urlPath = u.pathname + (u.search || '');
  } catch {
  }

  const apiFile = apiHandlerPath(urlPath.split('?')[0]);
  if (apiFile) {
    req.url = urlPath;
    if (!req.headers.host) req.headers.host = host;
    try {
      const handler = require(apiFile);
      await handler(req, res);
    } catch (e) {
      console.error('API', apiFile, e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('internal_error');
      }
    }
    return;
  }

  const file = safeResolveFile(urlPath.split('?')[0]);
  if (file) {
    serveFile(res, file);
    return;
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log(`StyleLog local dev → http://localhost:${PORT}/admin/index.html`);
  console.log(`핵심 지표 → http://localhost:${PORT}/admin/metrics.html`);
  console.log('(.env.local · SUPABASE_SERVICE_ROLE_KEY_DEV 필요 시 Supabase 대시보드에서 복사)');
  console.log('');
});
