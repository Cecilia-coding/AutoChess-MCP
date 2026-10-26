import { buildCompanionPrompt, parseCompanionSnapshot } from '@/lib/autochess/companion-prompt';
import { runCursor } from '@/lib/autochess/cursor';
import { CompanionJobs } from '@/lib/autochess/companion-jobs';
export const runtime = 'nodejs';
const jobs = new CompanionJobs((snapshot, signal) => runCursor(buildCompanionPrompt(snapshot), signal));
const validId = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(id);
const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  let input: { snapshot?: unknown; gameId?: unknown };
  try { input = await request.json() as { snapshot?: unknown; gameId?: unknown }; } catch { return reply({ code: 'BAD_JSON' }, 400); }
  const snapshot = parseCompanionSnapshot(input?.snapshot);
  if (!validId(input?.gameId) || !snapshot) return reply({ code: 'BAD_INPUT' }, 400);
  try { return reply({ job: jobs.start(input.gameId, snapshot) }, 202); }
  catch (error) { return reply({ code: error instanceof Error ? error.message : 'JOB_FAILED' }, 409); }
}
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const gameId = params.get('gameId'); const round = Number(params.get('round'));
  if (!validId(gameId) || !Number.isInteger(round) || round < 1 || round > 12) return reply({ code: 'BAD_INPUT' }, 400);
  const job = jobs.get(gameId, round);
  return job ? reply({ job }) : reply({ code: 'JOB_MISSING' }, 404);
}
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const gameId = params.get('gameId'); const round = params.has('round') ? Number(params.get('round')) : undefined;
  if (!validId(gameId) || (round !== undefined && (!Number.isInteger(round) || round < 1 || round > 12))) return reply({ code: 'BAD_INPUT' }, 400);
  jobs.cancel(gameId, round);
  return reply({ ok: true });
}
