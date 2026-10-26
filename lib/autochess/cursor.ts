import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const CURSOR_MODEL = 'composer-2.5';
export const CURSOR_TIMEOUT_MS = 90_000;

export function parseCursorOutput(stdout: string): { response: string; totalTokens: number | null } {
  const events = stdout.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const result = events.findLast(event => event.type === 'result');
  if (!result || result.is_error || typeof result.result !== 'string') throw new Error('CURSOR_BAD_RESULT');
  // Cursor versions do not consistently expose usage. Missing is not zero.
  const total = result.usage?.total_tokens;
  return { response: result.result.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''),
    totalTokens: typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : null };
}

export async function runCursor(prompt: string, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('CURSOR_ABORTED');
  const base = join(process.env.LOCALAPPDATA ?? '', 'cursor-agent', 'versions');
  const version = existsSync(base) ? readdirSync(base).filter(name => /^\d{4}\.\d{1,2}\.\d{1,2}-/.test(name))
    .sort().reverse().find(name => existsSync(join(base, name, 'node.exe')) && existsSync(join(base, name, 'index.js'))) : undefined;
  if (!version) throw new Error('CURSOR_NOT_FOUND');
  const workspace = join(process.cwd(), '.tmp', 'cursor-opponent');
  mkdirSync(workspace, { recursive: true });
  const started = Date.now();
  return new Promise<{ response: string; totalTokens: number | null; model: string; elapsedMs: number }>((resolve, reject) => {
    const child = spawn(join(base, version, 'node.exe'), [join(base, version, 'index.js'),
      '--print', '--output-format', 'stream-json', '--mode', 'ask', '--model', CURSOR_MODEL,
      '--trust', '--workspace', workspace, prompt], {
      cwd: workspace, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let bytes = 0;
    let done = false;
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (error) { reject(error); return; }
      try { resolve({ ...parseCursorOutput(stdout), model: CURSOR_MODEL, elapsedMs: Date.now() - started }); }
      catch { reject(new Error('CURSOR_BAD_RESULT')); }
    };
    const stop = (reason: string) => {
      // On Windows kill the specific spawned process tree, including CLI descendants.
      if (child.pid && process.platform === 'win32') {
        const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, stdio: 'ignore' });
        killer.on('error', () => child.kill());
      } else child.kill('SIGKILL');
      finish(new Error(reason));
    };
    const abort = () => stop('CURSOR_ABORTED');
    const timer = setTimeout(() => stop('CURSOR_TIMEOUT'), CURSOR_TIMEOUT_MS);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 128 * 1024) { stop('CURSOR_OUTPUT_LIMIT'); return; }
      stdout += chunk.toString('utf8');
    });
    child.stderr.resume();
    child.once('error', () => finish(new Error('CURSOR_EXEC_FAILED')));
    child.once('close', code => finish(code === 0 ? undefined : new Error('CURSOR_EXEC_FAILED')));
    if (signal?.aborted) abort();
  });
}
