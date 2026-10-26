'use client';

/** 账号登录态与棋室席位凭证分开存：清房间不会把人踢下线。 */
const ACCOUNT_KEY = 'autochess-account-v1';

export function readAccountToken(): string {
  try { return localStorage.getItem(ACCOUNT_KEY) ?? ''; } catch { return ''; }
}

export function writeAccountToken(token: string) {
  try { localStorage.setItem(ACCOUNT_KEY, token); } catch { /* 隐私模式忽略 */ }
  window.dispatchEvent(new Event('chess-account-change'));
}

export function clearAccountToken() {
  try { localStorage.removeItem(ACCOUNT_KEY); } catch { /* 隐私模式忽略 */ }
  window.dispatchEvent(new Event('chess-account-change'));
}
