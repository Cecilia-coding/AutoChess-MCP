import { customPackSchema, validateCustomPack, type CustomPackV1 } from './schema';

const STORAGE_KEY = 'autochess:pack-studio:shelf:v1';
const MAX_LOCAL_PACKS = 24;

export type LocalPackEntry = {
  id: string;
  updatedAt: number;
  pack: CustomPackV1;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadLocalPackShelf(): LocalPackEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: LocalPackEntry[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const check = customPackSchema.safeParse((entry as { pack?: unknown }).pack);
      if (!check.success) continue;
      valid.push({
        id: check.data.id,
        updatedAt:
          typeof (entry as { updatedAt?: unknown }).updatedAt === 'number'
            ? (entry as { updatedAt: number }).updatedAt
            : Date.now(),
        pack: check.data,
      });
    }
    return valid.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveLocalPackEntry(pack: CustomPackV1): LocalPackEntry[] {
  const current = loadLocalPackShelf().filter((entry) => entry.id !== pack.id);
  const next: LocalPackEntry[] = [{ id: pack.id, updatedAt: Date.now(), pack }, ...current].slice(
    0,
    MAX_LOCAL_PACKS,
  );
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function deleteLocalPackEntry(id: string): LocalPackEntry[] {
  const next = loadLocalPackShelf().filter((entry) => entry.id !== id);
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  return next;
}

export function buildExportPackPayload(pack: CustomPackV1): string {
  return JSON.stringify(
    {
      format: 'autochess-custom-pack',
      exportedAt: new Date().toISOString(),
      pack,
    },
    null,
    2,
  );
}

export function exportPackJsonFile(pack: CustomPackV1): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const safeName = (pack.title || pack.id)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .slice(0, 40) || 'custom-pack';
  const blob = new Blob([buildExportPackPayload(pack)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${safeName}.autochess-pack.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function parseImportedPackJson(
  rawText: string,
  newLocalId?: string,
): { ok: true; pack: CustomPackV1; warnings: string[] } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return { ok: false, error: 'JSON 语法解析失败，请确认导入的是棋谱 JSON 文件' };
  }
  const candidate =
    json && typeof json === 'object' && 'pack' in json ? (json as { pack: unknown }).pack : json;
  const result = validateCustomPack(candidate);
  if (!result.validSchema || !result.pack) {
    return {
      ok: false,
      error: result.errors.join('；') || '棋谱文件字段格式不合法',
    };
  }
  const pack: CustomPackV1 = newLocalId ? { ...result.pack, id: newLocalId } : result.pack;
  return { ok: true, pack, warnings: result.warnings };
}

