import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { autochessCostOf, findUnit } from '../../content/autochess/units';
import { packRoster, type PackId } from '../../packs/registry';
import type { MatchModeId } from './match-rules';
import type { RoomBattle } from './room-types';
import type { Combatant, TeamId, UnitStatLine } from './types';

const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FIGHTS = 5_000;

type UnitSample = { templateId: string; star: number; copies: number; damage: number; taken: number; healing: number; casts: number };
type FightSample = { id: string; at: number; pack: PackId; mode: MatchModeId; round: number; source: 'live' | 'lab'; outcome: 'left' | 'right' | 'draw'; leftBot: boolean; rightBot: boolean; left: UnitSample[]; right: UnitSample[] };
type Saved = { version: 1; startedAt: number; fights: FightSample[] };
type Entry = { unit: UnitSample; round: number; score: number; appearance: string };
type Cell = { count: number; score: number };

const stage = (round: number) => round <= 3 ? 1 : round <= 7 ? 2 : 3;
const winScore = (outcome: FightSample['outcome'], team: TeamId) => outcome === 'draw' ? 0.5 : outcome === team ? 1 : 0;
const cellKey = (cost: number, round: number, star: number) => `${cost}:${stage(round)}:${star}`;
const receiptId = (battleId: string) => createHash('sha256').update(battleId).digest('hex');

function unitsForBoard(board: readonly Combatant[], lines: readonly UnitStatLine[], team: TeamId): UnitSample[] {
  const byId = new Map(lines.filter(line => line.team === team).map(line => [line.id, line]));
  const grouped = new Map<string, UnitSample>();
  for (const piece of board) {
    const line = byId.get(piece.id);
    if (!line) continue;
    const key = `${piece.templateId}:${piece.star}`;
    const row = grouped.get(key) ?? { templateId: piece.templateId, star: piece.star, copies: 0, damage: 0, taken: 0, healing: 0, casts: 0 };
    row.copies += 1;
    row.damage += line.damageDealt;
    row.taken += line.damageTaken;
    row.healing += line.healingDone;
    row.casts += line.casts;
    grouped.set(key, row);
  }
  return [...grouped.values()];
}

/** 匿名、逐交手的轻量战斗收据；一队同名棋子只计一次入阵。 */
export class BalanceTelemetryStore {
  private readonly file: string;
  private saved: Saved;

  constructor(directory: string) {
    this.file = join(directory, 'balance-telemetry.json');
    if (existsSync(this.file)) {
      const loaded = JSON.parse(readFileSync(this.file, 'utf8')) as Saved;
      if (loaded.version !== 1 || !Array.isArray(loaded.fights)) throw new Error('BALANCE_TELEMETRY_VERSION_UNSUPPORTED');
      this.saved = loaded;
    } else {
      this.saved = { version: 1, startedAt: Date.now(), fights: [] };
      this.write(this.saved);
    }
  }

  get startedAt() { return this.saved.startedAt; }

  private write(next: Saved) {
    writeFileSync(`${this.file}.pending`, JSON.stringify(next), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${this.file}.pending`, this.file);
  }

  recordBattle(input: { pack: PackId; mode: MatchModeId; battle: RoomBattle; botSeats: readonly boolean[]; at?: number; source?: 'live' | 'lab' }): number {
    const at = input.at ?? Date.now();
    const seen = new Set(this.saved.fights.map(fight => fight.id));
    const added: FightSample[] = [];
    for (const fight of input.battle.fights ?? []) {
      const id = receiptId(fight.output.battleId);
      if (fight.ghost || seen.has(id)) continue;
      const left = unitsForBoard(input.battle.boards[fight.left] ?? [], fight.output.units, 'left');
      const right = unitsForBoard(input.battle.boards[fight.right] ?? [], fight.output.units, 'right');
      if (!left.length || !right.length) continue;
      added.push({ id, at, pack: input.pack, mode: input.mode, round: input.battle.round,
        source: input.source ?? 'live', outcome: fight.output.outcome, leftBot: !!input.botSeats[fight.left], rightBot: !!input.botSeats[fight.right], left, right });
      seen.add(id);
    }
    if (!added.length) return 0;
    const fights = [...this.saved.fights, ...added].filter(fight => fight.at >= Date.now() - WINDOW_MS).slice(-MAX_FIGHTS);
    const next = { ...this.saved, fights };
    this.write(next);
    this.saved = next;
    return added.length;
  }

  report(input: { pack?: PackId; mode?: MatchModeId; source?: 'live' | 'lab'; star?: 0 | 1 | 2 | 3 } = {}) {
    const now = Date.now();
    const fights = this.saved.fights.filter(fight => fight.at >= now - WINDOW_MS
      && (!input.pack || fight.pack === input.pack)
      && (!input.mode || fight.mode === input.mode)
      && (!input.source || fight.source === input.source));
    const entries = new Map<string, Entry[]>();
    const cells = new Map<string, Cell>();
    const byTemplateCell = new Map<string, Cell>();
    for (const fight of fights) for (const team of ['left', 'right'] as const) {
      const score = winScore(fight.outcome, team);
      for (const unit of fight[team]) {
        if (input.star && unit.star !== input.star) continue;
        const def = findUnit(unit.templateId);
        const key = cellKey(def ? autochessCostOf(def) : 0, fight.round, unit.star);
        const cell = cells.get(key) ?? { count: 0, score: 0 };
        cell.count += 1; cell.score += score; cells.set(key, cell);
        const ownKey = `${unit.templateId}|${key}`;
        const own = byTemplateCell.get(ownKey) ?? { count: 0, score: 0 };
        own.count += 1; own.score += score; byTemplateCell.set(ownKey, own);
        const list = entries.get(unit.templateId) ?? [];
        list.push({ unit, round: fight.round, score, appearance: `${fight.id}:${team}` }); entries.set(unit.templateId, list);
      }
    }
    const rows = [...entries].map(([templateId, list]) => {
      const def = findUnit(templateId);
      const cost = def ? autochessCostOf(def) : 0;
      const appearances = [...new Map(list.map(entry => [entry.appearance, entry])).values()];
      const games = appearances.length;
      const score = appearances.reduce((sum, entry) => sum + entry.score, 0);
      let peerScore = 0; let peerCount = 0;
      for (const entry of list) {
        const key = cellKey(cost, entry.round, entry.unit.star);
        const cell = cells.get(key)!;
        const own = byTemplateCell.get(`${templateId}|${key}`)!;
        const peers = cell.count - own.count;
        if (peers < 10) continue;
        peerScore += (cell.score - own.score) / peers;
        peerCount += 1;
      }
      const baseline = peerCount >= Math.max(10, Math.ceil(list.length / 2)) ? peerScore / peerCount : null;
      const deltaPts = baseline === null ? null : Math.round((score / games - baseline) * 1000) / 10;
      return { templateId, name: def?.name ?? templateId, cost, games, wins: appearances.filter(entry => entry.score === 1).length,
        pickRate: fights.length ? Math.round(games / (fights.length * 2) * 1000) / 10 : 0,
        draws: appearances.filter(entry => entry.score === 0.5).length, winRate: Math.round(score / games * 1000) / 10,
        baselineRate: baseline === null ? null : Math.round(baseline * 1000) / 10, deltaPts,
        avgDamage: Math.round(list.reduce((sum, entry) => sum + entry.unit.damage, 0) / games),
        avgTaken: Math.round(list.reduce((sum, entry) => sum + entry.unit.taken, 0) / games),
        avgHealing: Math.round(list.reduce((sum, entry) => sum + entry.unit.healing, 0) / games),
        avgStar: Math.round(list.reduce((sum, entry) => sum + entry.unit.star, 0) / list.length * 10) / 10,
        signal: games < 20 || deltaPts === null ? '样本少' : deltaPts >= 12 ? '偏强待看' : deltaPts <= -12 ? '偏弱待看' : '正常波动' };
    }).sort((a, b) => (b.deltaPts ?? -Infinity) - (a.deltaPts ?? -Infinity) || b.games - a.games);
    const all = this.saved.fights.filter(fight => fight.at >= now - WINDOW_MS && (!input.pack || fight.pack === input.pack));
    return { totalUnits: input.pack ? packRoster(input.pack).length : undefined, observedUnits: rows.length,
      sampleCounts: { live: all.filter(fight => fight.source === 'live').length, lab: all.filter(fight => fight.source === 'lab').length },
      lastBattleAt: fights.length ? Math.max(...fights.map(fight => fight.at)) : null, startedAt: this.saved.startedAt, retainedFrom: this.saved.fights[0]?.at ?? this.saved.startedAt, windowDays: 30,
      fights: fights.length, source: input.source ?? 'all', pack: input.pack ?? 'all', mode: input.mode ?? 'all', star: input.star ?? 0, rows };
  }
}
