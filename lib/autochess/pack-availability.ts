import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PACK_SUMMARIES, type PackId } from '../../packs/registry';

type SavedPackAvailability = { version: 1; disabled: string[] };

/** A pack switch affects only new rooms. Existing rooms keep their own pack. */
export class PackAvailabilityStore {
  private readonly file: string;
  private readonly disabled: Set<string>;

  constructor(directory: string) {
    mkdirSync(directory, { recursive: true });
    this.file = join(directory, 'pack-availability.json');
    if (!existsSync(this.file)) {
      this.disabled = new Set();
      return;
    }
    const saved = JSON.parse(readFileSync(this.file, 'utf8')) as SavedPackAvailability;
    if (saved.version !== 1 || !Array.isArray(saved.disabled) || saved.disabled.some(id => typeof id !== 'string')) {
      throw new Error('PACK_AVAILABILITY_VERSION_UNSUPPORTED');
    }
    this.disabled = new Set(saved.disabled);
  }

  isEnabled(id: PackId): boolean { return !this.disabled.has(id); }

  enabledPacks() { return PACK_SUMMARIES.filter(pack => this.isEnabled(pack.id)); }

  allPacks() { return PACK_SUMMARIES.map(pack => ({ ...pack, enabled: this.isEnabled(pack.id) })); }

  setEnabled(rawId: unknown, enabled: unknown) {
    const pack = PACK_SUMMARIES.find(candidate => candidate.id === rawId);
    if (!pack) throw new Error('未知棋谱');
    if (typeof enabled !== 'boolean') throw new Error('请选择开启或关闭');
    const next = new Set(this.disabled);
    if (enabled) next.delete(pack.id);
    else next.add(pack.id);
    const saved: SavedPackAvailability = { version: 1, disabled: [...next].sort() };
    writeFileSync(`${this.file}.pending`, JSON.stringify(saved), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${this.file}.pending`, this.file);
    this.disabled.clear();
    for (const id of next) this.disabled.add(id);
    return this.allPacks();
  }
}
