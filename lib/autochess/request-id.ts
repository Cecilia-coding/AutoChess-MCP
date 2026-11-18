/**
 * Isomorphic cryptographically random UUID v4 generator.
 * Works in Node.js, modern HTTPS browsers, and older HTTP WebViews via `getRandomValues`.
 * Never falls back to `Math.random()`: room and wallet mutations rely on collision-free IDs.
 */
export function newRequestId(prefix?: string): string {
  const secure = globalThis.crypto;
  if (!secure) throw new Error('当前环境缺少安全随机数接口');
  let id: string;
  if (typeof secure.randomUUID === 'function') {
    id = secure.randomUUID();
  } else {
    if (typeof secure.getRandomValues !== 'function') {
      throw new Error('当前浏览器不支持安全随机数，请更新浏览器后重试');
    }
    const bytes = new Uint8Array(16);
    secure.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const cleanPrefix = prefix ? prefix.trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
  return cleanPrefix ? `${cleanPrefix}-${id}`.slice(0, 80) : id;
}
