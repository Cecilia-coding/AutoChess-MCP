import { useSyncExternalStore } from 'react';
const EVENT = 'chess-local-avatar';
const key = (id: string) => `chess-avatar:${id}`;
function read(id: string): string {
  try { const value = localStorage.getItem(key(id)) ?? ''; return /^data:image\/(webp|png|jpeg);base64,/.test(value) ? value : ''; } catch { return ''; }
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback); window.addEventListener('storage', callback);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', callback); };
}
export function useLocalAvatar(id: string) { return useSyncExternalStore(subscribe, () => read(id), () => ''); }
export function clearLocalAvatar(id: string) { localStorage.removeItem(key(id)); window.dispatchEvent(new Event(EVENT)); }
export async function saveLocalAvatar(id: string, file: File) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('选一张 PNG、JPG 或 WebP 图片吧');
  if (file.size > 10 * 1024 * 1024) throw new Error('图片有点大，选一张 10 MB 以内的吧');
  const url = URL.createObjectURL(file);
  try {
    const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const picture = new Image();
      picture.onload = () => resolve(picture);
      picture.onerror = () => reject(new Error('这张图片没能打开，换一张 PNG、JPG 或 WebP 试试'));
      picture.src = url;
    });
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d'); if (!context) throw new Error('图片没能打开，再试一次');
    const edge = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap,(bitmap.width-edge)/2,(bitmap.height-edge)/2,edge,edge,0,0,256,256);
    const data = canvas.toDataURL('image/webp',.88);
    if (!/^data:image\/(webp|png|jpeg);base64,/.test(data)) throw new Error('头像生成失败，再选一次图片试试');
    try { localStorage.setItem(key(id),data); }
    catch { throw new Error('浏览器没能保存头像，请允许本站保存本地数据后重试'); }
    window.dispatchEvent(new Event(EVENT));
  } finally { URL.revokeObjectURL(url); }
}
