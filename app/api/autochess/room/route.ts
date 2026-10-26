export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== (process.env.CHESS_PUBLIC_ORIGIN || new URL(request.url).origin)) return Response.json({error:'来源无效'},{status:403});
    const body = await request.text();
    if(body.length>256_000) return Response.json({error:'请求过大'},{status:413});
    const upstream = await fetch(`http://127.0.0.1:${process.env.CHESS_ROOM_PORT ?? 8791}/room`,{method:'POST',headers:{'Content-Type':'application/json'},body,signal:AbortSignal.timeout(8_000)});
    return new Response(await upstream.text(),{status:upstream.status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  } catch {return Response.json({error:'房间服务暂时断开，恢复后会自动重连；你的棋局不会因切出网页而超时。'},{status:503});}
}
