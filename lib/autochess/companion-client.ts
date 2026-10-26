import type { DecisionJob } from './companion-jobs';
import type { CompanionSnapshot } from './companion-prompt';

export function cancelCompanionJob(gameId: string, round?: number) {
  if (!gameId) return;
  void fetch(`/api/autochess/companion?gameId=${encodeURIComponent(gameId)}${round === undefined ? '' : `&round=${round}`}`,
    { method: 'DELETE', keepalive: true }).catch(() => {});
}

/** Polling may pause in a background tab; inference and its deadline remain server-owned. */
export async function awaitCompanionJob(gameId: string, snapshot: CompanionSnapshot, signal: AbortSignal, onJob: (job: DecisionJob) => void) {
  const url = `/api/autochess/companion?gameId=${encodeURIComponent(gameId)}&round=${snapshot.round}`;
  let submitted = false;
  let misses = 0;
  while (!signal.aborted) {
    try {
      const response = await fetch(submitted ? url : '/api/autochess/companion', submitted
        ? { signal, cache: 'no-store' }
        : { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId, snapshot }) });
      const data = await response.json() as { code?: string; job?: DecisionJob };
      if (!response.ok) {
        if (response.status === 404) { submitted = false; throw new Error('JOB_MISSING'); }
        throw new Error(data.code ?? 'JOB_FAILED');
      }
      submitted = true; misses = 0;
      const job = data.job;
      if (!job || job.gameId !== gameId || job.round !== snapshot.round) throw new Error('JOB_MISMATCH');
      onJob(job);
      if (job.status === 'ready' && job.result) return job.result;
      if (job.status === 'failed' || job.status === 'cancelled') throw new Error(job.code ?? 'GAME_CANCELLED');
    } catch (error) {
      if (signal.aborted) throw new Error('GAME_CANCELLED');
      // Retry transport, not inference: the server deduplicates POST by game+round.
      if (!(error instanceof TypeError) && !(error instanceof SyntaxError) && !(error instanceof Error && error.message === 'JOB_MISSING')) throw error;
      if (++misses >= 5) throw new Error('CONNECTION_LOST');
    }
    await new Promise<void>(resolve => {
      const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); document.removeEventListener('visibilitychange', visible); resolve(); };
      const visible = () => { if (document.visibilityState === 'visible') finish(); };
      const timer = setTimeout(finish, 1000);
      signal.addEventListener('abort', finish, { once: true });
      document.addEventListener('visibilitychange', visible);
    });
  }
  throw new Error('GAME_CANCELLED');
}
