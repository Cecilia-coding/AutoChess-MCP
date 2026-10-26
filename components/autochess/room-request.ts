'use client';

const OFFLINE = '网络中断，棋盘仍保留；连上后会自动同步';

async function post<T>(path: string, body: object, offline = OFFLINE): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(8_000) });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError' || name === 'TimeoutError' || error instanceof TypeError) throw new Error(offline);
    throw error instanceof Error ? error : new Error(offline);
  }
  let result: T & { error?: string };
  try { result = JSON.parse(await response.text()) as T & { error?: string }; }
  catch { throw new Error(offline); }
  if (!response.ok) throw new Error(result.error || offline);
  return result;
}

/** 棋室操作（房间/对局）。 */
export function roomRequest<T = unknown>(op: string, args: object = {}): Promise<T> {
  return post<T>('/api/autochess/room', { op, ...args });
}

/** 账号与匹配（注册/登录/匹配队列）。 */
export function accountRequest<T = unknown>(op: string, args: object = {}): Promise<T> {
  return post<T>('/api/autochess/account', { op, ...args });
}

/** 局外外观/货币/排行。 */
export function metaRequest<T = unknown>(op: string, args: object = {}): Promise<T> {
  return post<T>('/api/autochess/meta', { op, ...args }, '外观服务暂时断开，恢复后重试。');
}
