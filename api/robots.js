/**
 * 호스트별 robots.txt 동적 반환
 * - alpha.stylelog.co.kr: 전체 크롤링 차단 (테스트 환경)
 * - www.stylelog.co.kr 등: 크롤링 허용 + sitemap
 */
export default function handler(req, res) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const isAlpha = host.includes('alpha');

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': isAlpha ? 's-maxage=3600, stale-while-revalidate' : 's-maxage=86400, stale-while-revalidate',
  };

  let body;
  if (isAlpha) {
    body = `User-agent: *
Disallow: /`;
  } else {
    const baseUrl = host ? `https://${host}` : 'https://www.stylelog.co.kr';
    body = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`;
  }

  res.writeHead(200, headers);
  res.end(body);
}
