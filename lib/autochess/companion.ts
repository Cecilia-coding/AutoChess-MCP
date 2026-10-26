import { BENCH_CAPACITY } from './constants';
import { autochessCostOf, getUnit } from '../../content/autochess/units';
import { SHOP_REFRESH_COST } from './core';
import type { UnitDef } from '../../content/autochess/types';
import { addAndMerge, sellFromRoster, equipFromRoster, unequipFromRoster } from './core';
import type { AutochessPiece } from './core';

export type CompanionPlan = {
  say: string;
  sell: string[];
  buy: number[];
  field?: string[];
  keepField?: boolean;
  equip?: { piece: string; item: string }[];
  unequip?: { piece: string; item: string }[];
  positions?: { piece: string; row: number; col: number }[];
  refresh?: number;
  hex?: string;
  /** 装备宝箱多选一：本轮要选中的装备 id。 */
  item?: string;
  /** 花金币购买经验的次数（每次 4 金）。 */
  buyXp?: number;
  /** 开局装备三选一：要选中的装备 id。 */
  sword?: string;
};

export type CompanionApplyInput = {
  board: AutochessPiece[];
  bench: AutochessPiece[];
  gold: number;
  shop: UnitDef[];
  priceOf?: (unit: UnitDef) => number;
  capacity: number;
  idPrefix: string;
  plan: CompanionPlan;
  inventory?: string[];
  /** 本包掉落池：装备校验按包走，不串别包（不传则退回全局，兼容旧调用）。 */
  loot?: readonly { id: string }[];
  onInvalid?: (reason: string) => void;
  recoverPositions?: boolean;
  refreshShop?: () => UnitDef[];
  shopLocked?: boolean;
};

export type CompanionApplyResult = {
  board: AutochessPiece[];
  bench: AutochessPiece[];
  gold: number;
  purchaseSpent: number;
  returnedItems: string[];
  inventory: string[];
  resolvedRefs: Record<string,string>;
  adjustments: string[];
};

function uniqueStrings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'string')) return null;
  if (new Set(value).size !== value.length) return null;
  return [...value];
}

function uniqueBuyIndexes(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => Number.isInteger(entry) && entry >= 0 && entry <= 4)) return null;
  if (new Set(value).size !== value.length) return null;
  return [...value] as number[];
}

export function parseCompanionPlan(raw: string, onInvalid?: (reason: string) => void): CompanionPlan | null {
  const invalid = (reason: string): null => { onInvalid?.(reason); return null; };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return invalid('plan 必须是有效 JSON 对象');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid('plan 必须是对象');
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const unknown = keys.filter(key => !['buy', 'field', 'keepField', 'say', 'sell', 'equip', 'unequip', 'positions', 'refresh', 'hex', 'item', 'buyXp', 'sword'].includes(key));
  if (unknown.length) return invalid(`plan 不支持字段：${unknown.map(key=>`plan.${key}`).join('、')}`);
  if (!keys.includes('say')) return invalid('缺少 plan.say：填写 1–30 字');
  if (!keys.includes('field')&&record.keepField!==true) return invalid('缺少 plan.field：填写完整上场名单，或用 plan.keepField=true 保留阵容');
  if(record.keepField!==undefined&&typeof record.keepField!=='boolean')return invalid('plan.keepField 必须是布尔值');
  if(record.keepField===true&&Array.isArray(record.field)&&record.field.length>0)return invalid('plan.keepField=true 与非空 plan.field 互斥：保阵请省略 field；重新布阵请省略 keepField 或设为 false');

  if (typeof record.say !== 'string') return invalid('plan.say 必须是字符串');
  const sayLen = Array.from(record.say).length;
  if (sayLen < 1 || sayLen > 30) return invalid('plan.say 须为 1–30 字');

  // Omitted action lists mean no action; malformed supplied lists still fail.
  const sell = uniqueStrings(record.sell === undefined ? [] : record.sell);
  if (!sell || sell.length > 3) return invalid('plan.sell 须为最多 3 个不重复的棋子引用');
  const buy = uniqueBuyIndexes(record.buy === undefined ? [] : record.buy);
  if (!buy || buy.length > 5) return invalid('plan.buy 须为 0–4 的商店格号数组，最多 5 个且不能重复');
  if (record.refresh !== undefined && (typeof record.refresh !== 'number' || !Number.isInteger(record.refresh) || record.refresh < 0 || record.refresh > 8)) return invalid('plan.refresh 须为 0–8 的整数；player 请单独 act(kind=refresh)');
  const field = uniqueStrings(record.field??(record.keepField===true?[]:undefined));
  if (!field || field.length > 10) return invalid('plan.field 须为最多 10 个不重复的棋子引用');

  for (const key of ['equip', 'unequip'] as const) {
    const value = record[key];
    if (value !== undefined && (!Array.isArray(value) || value.length > 16 || value.some(x => !x || typeof x.piece !== 'string' || typeof x.item !== 'string'))) return invalid(`plan.${key} 须为最多 16 项的数组，每项填写 piece 和 item 字符串`);
  }
  if (record.positions !== undefined) {
    if (!Array.isArray(record.positions) || record.positions.length > 10) return invalid('plan.positions 须为最多 10 项的数组');
    for (const [i,x] of record.positions.entries()) {
      if (!x || typeof x.piece !== 'string') return invalid(`plan.positions[${i}].piece 必须是棋子引用字符串`);
      if (!Number.isInteger(x.row) || x.row < 0 || x.row > 3) return invalid(`plan.positions[${i}].row 须为 0–3 的整数`);
      if (!Number.isInteger(x.col) || x.col < 0 || x.col > 4) return invalid(`plan.positions[${i}].col 须为 0–4 的整数`);
    }
  }

  if (record.hex !== undefined && (typeof record.hex !== 'string' || !record.hex.length || record.hex.length > 80)) return invalid('plan.hex 须为 1–80 字符的心悟 ID');
  if (record.item !== undefined && (typeof record.item !== 'string' || !record.item.length || record.item.length > 80)) return invalid('plan.item 须为 1–80 字符的装备 ID');
  if (record.buyXp !== undefined && (!Number.isInteger(record.buyXp) || (record.buyXp as number) < 0 || (record.buyXp as number) > 8)) return invalid('plan.buyXp 须为 0–8 的整数');
  if (record.sword !== undefined && (typeof record.sword !== 'string' || !record.sword.length || record.sword.length > 80)) return invalid('plan.sword 须为 1–80 字符的开局装备 ID');
  return { say: record.say, sell, buy, field,
    ...(record.keepField===true?{keepField:true}:{}),
    ...(typeof record.refresh === 'number' && record.refresh > 0 ? { refresh: record.refresh } : {}),
    ...(typeof record.hex === 'string' ? { hex: record.hex } : {}),
    ...(typeof record.item === 'string' ? { item: record.item } : {}),
    ...(typeof record.buyXp === 'number' && record.buyXp > 0 ? { buyXp: record.buyXp } : {}),
    ...(typeof record.sword === 'string' ? { sword: record.sword } : {}),
    ...(record.equip !== undefined ? { equip: record.equip as CompanionPlan['equip'] } : {}),
    ...(record.unequip !== undefined ? { unequip: record.unequip as CompanionPlan['unequip'] } : {}),
    ...(record.positions !== undefined ? { positions: record.positions as CompanionPlan['positions'] } : {}) };
}

function clonePiece(piece: AutochessPiece): AutochessPiece {
  return { ...piece, itemIds: [...piece.itemIds] };
}

const preferredRows=(piece:AutochessPiece)=>['melee','tank'].includes(getUnit(piece.templateId).role)?[3,2,1,0]:[0,1,2,3];

function autoPlace(units: AutochessPiece[]): AutochessPiece[] {
  const used = new Set<string>();
  const nextCol = new Map<number, number>([
    [0, 0],
    [1, 0],
    [2, 0],
    [3, 0],
  ]);
  const rows = (piece: AutochessPiece): [number, number] => {
    const role = getUnit(piece.templateId).role;
    return role === 'melee' || role === 'tank' ? [3, 2] : [0, 1];
  };

  const out: AutochessPiece[] = [];
  for (const piece of units) {
    const [firstRow, secondRow] = rows(piece);
    const firstCol = nextCol.get(firstRow)!;
    if (firstCol <= 4) {
      nextCol.set(firstRow, firstCol + 1);
      out.push({ ...piece, itemIds: [...piece.itemIds], localRow: firstRow, localCol: firstCol });
      continue;
    }
    const secondCol = nextCol.get(secondRow)!;
    if (secondCol <= 4) {
      nextCol.set(secondRow, secondCol + 1);
      out.push({ ...piece, itemIds: [...piece.itemIds], localRow: secondRow, localCol: secondCol });
      continue;
    }
    return [];
  }

  for (const piece of out) {
    const key = `${piece.localRow}:${piece.localCol}`;
    if (used.has(key)) return [];
    used.add(key);
  }
  return out;
}

export function applyCompanionPlan(input: CompanionApplyInput): CompanionApplyResult | null {
  const invalid = (reason: string): null => { input.onInvalid?.(reason); return null; };
  for (const [path,ref] of [...(input.plan.field??[]).map((ref,i)=>[`plan.field[${i}]`,ref]), ...(input.plan.positions??[]).map((p,i)=>[`plan.positions[${i}].piece`,p.piece])]) {
    if (ref.startsWith('shop:') && (!/^shop:[0-4]$/.test(ref) || !input.plan.buy.includes(Number(ref.slice(5))))) return invalid(`${path}=${ref}：shop:N 可以上场，但 N 须为 0–4 且列在同一次 plan.buy 中；已买入的棋子请用回包里的 cN`);
  }
  const capacity = Math.trunc(input.capacity);
  if (!Number.isFinite(capacity) || capacity < 1 || capacity > 10 || !Number.isFinite(input.gold) || input.gold < 0) return null;

  let board = input.board.map(clonePiece);
  let bench = input.bench.map(clonePiece);
  let gold = input.gold;
  let purchaseSpent = 0;
  const returnedItems: string[] = [];
  const boughtRefToPieceId = new Map<number, string>();
  const resolvedRefs: Record<string,string> = {};
  const adjustments: string[] = [];
  let inventory = [...(input.inventory ?? [])];
  for (const action of input.plan.unequip ?? []) {
    const result = unequipFromRoster(board, bench, action.piece, action.item);
    if (!result.removed) return invalid(`卸装失败：${action.piece} 没有 ${action.item}`);
    board = result.board; bench = result.bench;
    inventory.push(action.item);
  }

  for (const id of input.plan.sell) {
    const sold = sellFromRoster(board, bench, id);
    if (!sold) return invalid(`出售失败：棋子 ${id} 不存在`);
    board = sold.board.map(clonePiece);
    bench = sold.bench.map(clonePiece);
    gold += sold.gold;
    returnedItems.push(...sold.returnedItems);
  }

  let shop = [...input.shop];
  const refreshes = input.plan.refresh ?? 0;
  if (refreshes) {
    if (!input.refreshShop) return invalid('本席位现在不能刷新商店');
    for (let i = 0; i < refreshes; i += 1) {
      if (gold < SHOP_REFRESH_COST) return invalid(`刷新要 ${SHOP_REFRESH_COST} 金，剩余 ${gold}`);
      gold -= SHOP_REFRESH_COST;
      shop = input.refreshShop();
      if (!shop.length) return invalid('现在没有商店');
    }
  }

  let buySeq = 0;
  if (input.shopLocked && input.plan.buy.length) return invalid('养精蓄锐生效中，不能买棋');
  for (const index of input.plan.buy) {
    const unit = shop[index];
    if (!unit) return invalid(`商店 ${index} 已售罄或不存在`);
    const cost = input.priceOf?.(unit) ?? autochessCostOf(unit);
    if (!Number.isFinite(cost) || cost < 0) return invalid("商店价格无效");
    if (gold < cost) return invalid(`购买商店 ${index} 金币不足：需要 ${cost}，剩余 ${gold}`);
    gold -= cost;
    purchaseSpent += cost;

    const addedId = `${input.idPrefix}${buySeq}`;
    buySeq += 1;
    const merged = addAndMerge(board, bench, {
      id: addedId,
      templateId: unit.id,
      star: 1,
      localRow: 0,
      localCol: 0,
      itemIds: [],
    });
    board = merged.board.map(clonePiece);
    bench = merged.bench.map(clonePiece);
    returnedItems.push(...merged.returnedItems);
    for (const [consumed,survivor] of Object.entries(merged.consumed)) {
      for (const ref of Object.keys(resolvedRefs)) if (resolvedRefs[ref] === consumed) resolvedRefs[ref] = survivor;
      resolvedRefs[consumed] = survivor;
      for (const [slot,id] of boughtRefToPieceId) if (id === consumed) boughtRefToPieceId.set(slot,survivor);
    }

    const survivor=merged.consumed[addedId]??addedId;
    if(![...board,...bench].some(p=>p.id===survivor))return invalid('无法确定合成后的棋子引用');
    boughtRefToPieceId.set(index,survivor);
  }

  const roster = [...board, ...bench];
  const field=input.plan.keepField?input.board.filter(p=>!input.plan.sell.includes(p.id)).map(p=>p.id):input.plan.field??[];
  if (roster.length > 0 && field.length === 0) return invalid('至少上场一名棋子；原阵容已清空时请指定field');
  const byId = new Map(roster.map((piece) => [piece.id, piece] as const));
  const toField: AutochessPiece[] = [];
  const seen = new Set<string>();

  for (const ref of field) {
    let pieceId = resolvedRefs[ref] ?? ref;
    if (ref.startsWith('shop:')) {
      const indexText = ref.slice(5);
      if (!/^\d+$/.test(indexText)) return invalid(`无效新棋引用：${ref}`);
      const index = Number(indexText);
      if (!input.plan.buy.includes(index)) return invalid(`${ref} 未在本轮购买`);
      const mapped = boughtRefToPieceId.get(index);
      if (!mapped) return invalid(`${ref} 没有对应的购买记录`);
      pieceId = mapped;
    }
    if (seen.has(pieceId)) continue; // Multiple purchased copies can merge into one survivor.
    seen.add(pieceId);
    const piece = byId.get(pieceId);
    if (!piece) return invalid(`上场引用不存在：${ref}，合成后请引用存活棋子或shop:N`);
    toField.push(clonePiece(piece));
  }

  // 外援不占人口，不计入容量
  const fieldCost = toField.filter((piece) => !getUnit(piece.templateId).ally).length;
  if (fieldCost > capacity) return invalid(`上场 ${fieldCost} 个超过容量 ${capacity}`);
  const existingField = new Map(board.map(piece => [piece.id, piece]));
  const newcomerPositions = new Map(autoPlace(toField.filter(piece => !existingField.has(piece.id))).map(piece => [piece.id, piece]));
  let placed = toField.map(piece => {
    const previous = existingField.get(piece.id);
    return previous ? { ...piece, localRow: previous.localRow, localCol: previous.localCol }
      : newcomerPositions.get(piece.id) ?? { ...piece, localRow: preferredRows(piece)[0]!, localCol: 0 };
  });
  if (placed.length !== toField.length) return null;

  const resolveRef = (ref: string) => ref.startsWith('shop:') ? boughtRefToPieceId.get(Number(ref.slice(5))) : resolvedRefs[ref] ?? ref;
  const positioned = new Set<string>();
  const reserved = new Set<string>();
  const displaced = new Set<string>();
  const groups=new Map<string,{id:string;row:number;col:number}[]>();
  const requested=new Set<string>();
  for (const position of input.plan.positions??[]) {
    const id = resolveRef(position.piece);
    if (!id || !placed.some(piece => piece.id === id)) return invalid(`站位引用 ${position.piece} 不在上场名单`);
    if (requested.has(id)) {
      if (!input.recoverPositions) return invalid(`同一棋子 ${position.piece} 被重复设置站位（可能已合成）`);
      adjustments.push('合成后重复站位已合并，保留第一处指定位置'); continue;
    }
    if (!Number.isInteger(position.row) || position.row < 0 || position.row > 3 || !Number.isInteger(position.col) || position.col < 0 || position.col > 4) return invalid('站位坐标超出棋盘');
    const cell = `${position.row}:${position.col}`;
    if(groups.has(cell)&&!input.recoverPositions)return invalid('指定站位重叠：两名棋子不能占用同一格');
    requested.add(id);
    groups.set(cell,[...groups.get(cell)??[],{id,row:position.row,col:position.col}]);
  }
  for(const [cell,contestants] of groups){
    contestants.sort((a,b)=>preferredRows(placed.find(p=>p.id===a.id)!).indexOf(a.row)-preferredRows(placed.find(p=>p.id===b.id)!).indexOf(b.row));
    const position=contestants[0]!;
    for(let i=1;i<contestants.length;i++){displaced.add(contestants[i]!.id);adjustments.push('重叠站位已按职能安排：近战优先前排，远程/辅助优先后排');}
    reserved.add(cell);positioned.add(position.id);
    placed=placed.map(p=>p.id===position.id?{...p,localRow:position.row,localCol:position.col}:p);
  }
  // Explicit cells take precedence; omitted positions must find a free cell.
  // Otherwise a valid partial placement can collide with the automatic layout.
  const placementOrder = [...placed].sort((a,b) => Number(existingField.has(b.id)) - Number(existingField.has(a.id)));
  const settledPositions = new Map(placementOrder.map(piece => {
    if (positioned.has(piece.id)) return [piece.id, piece] as const;
    let row = piece.localRow; let col = piece.localCol;
    if (displaced.has(piece.id)||reserved.has(`${row}:${col}`)) {
      const rows = preferredRows(piece);
      const free = rows.flatMap(r => [0,1,2,3,4].map(c => ({row:r,col:c}))).find(p => !reserved.has(`${p.row}:${p.col}`))!;
      row = free.row; col = free.col;
    }
    reserved.add(`${row}:${col}`); return [piece.id, {...piece,localRow:row,localCol:col}] as const;
  }));
  placed = placed.map(piece => settledPositions.get(piece.id)!);
  if (new Set(placed.map(piece => `${piece.localRow}:${piece.localCol}`)).size !== placed.length) return invalid('站位重叠：请为所有上场棋子分配不同格子');

  const placedIds = new Set(placed.map((piece) => piece.id));
  let nextBench = roster.filter((piece) => !placedIds.has(piece.id)).map(clonePiece);
  if (nextBench.length > BENCH_CAPACITY) return invalid(`部署后备战区超过${BENCH_CAPACITY}个`);
  inventory.push(...returnedItems);
  for (const action of input.plan.equip ?? []) {
    const id = resolveRef(action.piece);
    if (!id) return invalid(`装配引用不存在：${action.piece}`);
    const equipped = equipFromRoster(placed, nextBench, inventory, id, action.item, input.loot);
    if (!equipped) return invalid(`装配失败：${action.piece} / ${action.item}，检查装备库存、同名重复与两件上限`);
    placed = equipped.board; nextBench = equipped.bench; inventory = equipped.inventory;
  }
  return {
    board: placed,
    bench: nextBench,
    gold,
    purchaseSpent,
    returnedItems,
    inventory,
    resolvedRefs: {...resolvedRefs,...Object.fromEntries([...boughtRefToPieceId].map(([slot,id])=>[`shop:${slot}`,id]))},
    adjustments,
  };
}

export function createCallGate() {
  let current = 0;
  return {
    begin(): number {
      current += 1;
      return current;
    },
    cancel(): void {
      current += 1;
    },
    isCurrent(token: number): boolean {
      return token === current;
    },
  };
}
