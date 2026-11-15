export type Tile = {
  id: number;
  name: string;
  detail: string;
  type: 'encounter' | 'rest' | 'fortune' | 'boss' | 'shop';
  coordinate: [number, number];
};

/** 公共棋盘只提供中性旅途拓扑与兜底地名；各扩展包通过 `draftTiles` 覆盖专属地名。 */
const stops: readonly [string, string, Tile['type']][] = [
  ['启程点', '启程', 'rest'], ['前路驿站', '相遇', 'encounter'], ['奇缘石碑', '探秘', 'fortune'],
  ['林间岔道', '同行', 'encounter'], ['行商早摊', '淘货', 'shop'], ['清泉歇脚', '休整', 'rest'],
  ['藏宝古龛', '寻珍', 'fortune'], ['险关渡口', '试炼', 'boss'], ['长桥风口', '问路', 'encounter'],
  ['百货集市', '拾遗', 'shop'], ['避风草亭', '调息', 'rest'], ['晚钟长亭', '听闻', 'encounter'],
  ['星灯祈愿', '求缘', 'fortune'], ['关隘重门', '考较', 'boss'], ['乱石险坡', '涉险', 'encounter'],
  ['迷雾幽谷', '试错', 'encounter'], ['安营宿夜', '养神', 'rest'], ['晨光终点', '收官', 'fortune'],
];

const coordinates: readonly [number, number][] = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 6], [3, 6], [4, 6],
  [5, 6], [5, 5], [5, 4], [5, 3], [5, 2], [5, 1], [4, 1], [3, 1], [2, 1],
];

export const tiles: Tile[] = stops.map(([name, detail, type], id) => ({ id, name, detail, type, coordinate: coordinates[id]! }));
export const TILE_COUNT = tiles.length;

export const typeLabel: Record<Tile['type'], string> = {
  encounter: '对局', rest: '休整', fortune: '机缘', boss: '关隘', shop: '商店',
};

/** 将扩展包声明的选秀地名覆写到公共旅途拓扑骨架上。 */
export function resolveTiles(packTiles?: readonly { name: string; detail: string }[]): Tile[] {
  if (!packTiles?.length) return tiles;
  return tiles.map((tile, index) => ({
    ...tile,
    name: packTiles[index]?.name ?? tile.name,
    detail: packTiles[index]?.detail ?? tile.detail,
  }));
}

export function getTile(position: number): Tile {
  return tiles[position] ?? tiles[0]!;
}
