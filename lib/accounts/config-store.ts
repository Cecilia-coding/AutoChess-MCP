import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_GAME_CONFIG,
  normalizeGameConfig,
  setRuntimeGameConfig,
  validateGameConfig,
  type GameConfigData,
  type GameConfigSectionId,
} from '../meta/game-config';

type PersistedConfigEnvelope = {
  version: number;
  updatedAt: number;
  config: GameConfigData;
};

/**
 * 持久化后台配置表仓储：负责读取、校验、原子落盘与热更新运行时配置快照。
 * 单一来源写入 `<directory>/game-config.json`，并通过 `setRuntimeGameConfig` 即时通知引擎与接口层。
 */
export class GameConfigStore {
  private readonly file: string;
  private config: GameConfigData;
  private lastUpdatedAt: number;

  constructor(private readonly directory: string) {
    mkdirSync(directory, { recursive: true });
    this.file = join(directory, 'game-config.json');
    const loaded = this.readPersisted();
    this.config = loaded.config;
    this.lastUpdatedAt = loaded.updatedAt;
    setRuntimeGameConfig(this.config);
  }

  private readPersisted(): { config: GameConfigData; updatedAt: number } {
    if (!existsSync(this.file)) {
      return { config: structuredClone(DEFAULT_GAME_CONFIG), updatedAt: 0 };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<PersistedConfigEnvelope> | GameConfigData;
      const candidate =
        parsed && typeof parsed === 'object' && 'config' in parsed && parsed.config
          ? parsed.config
          : parsed;
      const updatedAt =
        parsed && typeof parsed === 'object' && 'updatedAt' in parsed && typeof parsed.updatedAt === 'number'
          ? parsed.updatedAt
          : 0;
      return { config: normalizeGameConfig(candidate), updatedAt };
    } catch {
      return { config: structuredClone(DEFAULT_GAME_CONFIG), updatedAt: 0 };
    }
  }

  get(): GameConfigData {
    return structuredClone(this.config);
  }

  updatedAt(): number {
    return this.lastUpdatedAt;
  }

  isCustomized(): boolean {
    return this.lastUpdatedAt > 0;
  }

  save(rawConfig: unknown): GameConfigData {
    const validated = validateGameConfig(rawConfig);
    const nextUpdatedAt = Date.now();
    this.persist(validated, nextUpdatedAt);
    this.config = validated;
    this.lastUpdatedAt = nextUpdatedAt;
    setRuntimeGameConfig(this.config);
    return this.get();
  }

  reset(section?: GameConfigSectionId | 'all'): GameConfigData {
    const base = structuredClone(this.config);
    const next: GameConfigData =
      !section || section === 'all'
        ? structuredClone(DEFAULT_GAME_CONFIG)
        : {
            ...base,
            ...(section === 'cosmetics' ? { cosmetics: structuredClone(DEFAULT_GAME_CONFIG.cosmetics) } : {}),
            ...(section === 'pacing' ? { pacing: structuredClone(DEFAULT_GAME_CONFIG.pacing) } : {}),
            ...(section === 'economy' ? { economy: structuredClone(DEFAULT_GAME_CONFIG.economy) } : {}),
            ...(section === 'arcade' ? { arcade: structuredClone(DEFAULT_GAME_CONFIG.arcade) } : {}),
            ...(section === 'odds' ? { odds: structuredClone(DEFAULT_GAME_CONFIG.odds) } : {}),
            ...(section === 'buffs' ? { buffs: structuredClone(DEFAULT_GAME_CONFIG.buffs) } : {}),
          };
    const nextUpdatedAt = !section || section === 'all' ? 0 : Date.now();
    this.persist(next, nextUpdatedAt);
    this.config = next;
    this.lastUpdatedAt = nextUpdatedAt;
    setRuntimeGameConfig(this.config);
    return this.get();
  }

  private persist(config: GameConfigData, updatedAt: number): void {
    const envelope: PersistedConfigEnvelope = {
      version: 1,
      updatedAt,
      config,
    };
    writeFileSync(`${this.file}.pending`, JSON.stringify(envelope, null, 2), { encoding: 'utf8', mode: 0o600 });
    renameSync(`${this.file}.pending`, this.file);
  }
}

