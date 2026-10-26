export const runtime = 'nodejs';

import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { BOARD_ASSETS, BOARD_DIR } from '@/lib/meta/board-assets';

/** 按 key 流式返回「棋盘」目录里的 GLB：源文件只有一份，不进 public、不复制。 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') ?? '';
  const asset = BOARD_ASSETS[key];
  if (!asset) return new Response('未知棋盘', { status: 404 });
  const root = resolve(process.cwd(), BOARD_DIR);
  const file = resolve(root, asset.file);
  if (file !== root && !file.startsWith(root + sep)) return new Response('非法路径', { status: 400 });
  try {
    const data = await readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': 'model/gltf-binary', 'Content-Length': String(data.byteLength), 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return new Response('棋盘资源缺失', { status: 404 });
  }
}
