import { FEEDBACK_LIMITS } from '@/lib/meta/feedback';
export const runtime = 'nodejs';
let active = 0;
const jsonError = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== (process.env.CHESS_PUBLIC_ORIGIN || new URL(request.url).origin)) return jsonError('来源无效', 403);
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer [a-zA-Z0-9_-]{20,100}$/.test(authorization)) return jsonError('请先登录，再来反馈处', 401);
  if (request.headers.get('content-encoding') || Number(request.headers.get('content-length')) > FEEDBACK_LIMITS.bodyBytes) return jsonError('请求过大', 413);
  if (active >= 4) return jsonError('反馈处忙碌，请稍后重试', 429);
  active++;
  const reader = request.body?.getReader();
  const timer = setTimeout(() => { void reader?.cancel(); }, 12_000);
  try {
    if (!reader) return jsonError('请填写反馈内容', 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > FEEDBACK_LIMITS.bodyBytes) { await reader.cancel(); return jsonError('请求过大', 413); }
      chunks.push(value);
    }
    const upstream = await fetch(`http://127.0.0.1:${process.env.CHESS_ROOM_PORT ?? 8791}/feedback`, {
      method: 'POST', headers: { authorization, 'Content-Type': 'application/json' }, body: Buffer.concat(chunks).toString('utf8'), signal: AbortSignal.timeout(15_000),
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return jsonError('反馈暂未送达，请保留内容并重试', 503); }
  finally { clearTimeout(timer); reader?.releaseLock(); active--; }
}
