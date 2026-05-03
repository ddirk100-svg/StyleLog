#!/usr/bin/env node
/**
 * 관리자용 ADMIN_TOTP_SECRET(Base32) · ADMIN_SESSION_SECRET(hex) 생성.
 * Windows에서 openssl 없이 사용: npm run admin:secrets
 *
 * ⚠ 출력은 레포/채팅에 남기지 말고, Vercel·메모장에만 사용하세요.
 */

const crypto = require('crypto');

const RFC4648 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesToBase32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += RFC4648[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += RFC4648[(value << (5 - bits)) & 31];
  }
  return out;
}

const totpSecret = bytesToBase32(crypto.randomBytes(20));
const sessionSecret = crypto.randomBytes(32).toString('hex');

console.log('');
console.log('=== Vercel Environment Variables에 넣을 값 (이 화면만 보고 복사) ===\n');
console.log('Key: ADMIN_TOTP_SECRET');
console.log('Value: ' + totpSecret);
console.log('');
console.log('Key: ADMIN_SESSION_SECRET');
console.log('Value: ' + sessionSecret);
console.log('');
console.log('=== Google Authenticator ===');
console.log('「설정 키 입력」→ 키: 위 ADMIN_TOTP_SECRET 의 Value 와 동일하게 (시간 기반)');
console.log('');
console.log('그 다음: Vercel 저장 → Redeploy');
console.log('');
