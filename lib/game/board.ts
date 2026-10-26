export type Tile = {
  id: number;
  name: string;
  detail: string;
  type: 'encounter' | 'rest' | 'fortune' | 'boss' | 'shop';
  coordinate: [number, number];
};

const stops: readonly [string, string, Tile['type']][] = [
  ['开机自检', '启程', 'rest'], ['训练集群', '预热', 'encounter'], ['数据集', '清洗', 'fortune'],
  ['推理服务', '上线', 'encounter'], ['模型市场', '逛摊', 'shop'], ['开源社区', '协作', 'rest'],
  ['微调工坊', '炼丹', 'fortune'], ['算力荒原', '抢卡', 'boss'], ['长文本深海', '翻书', 'encounter'],
  ['Token 集市', '买量', 'shop'], ['缓存池', '歇脚', 'rest'], ['提示词夜市', '套话', 'encounter'],
  ['多模态广场', '看图', 'fortune'], ['对齐实验室', '考核', 'boss'], ['限流峡谷', '排队', 'encounter'],
  ['幻觉迷宫', '试错', 'encounter'], ['回滚机房', '兜底', 'rest'], ['部署上线', '收工', 'fortune'],
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

export function getTile(position: number): Tile {
  return tiles[position] ?? tiles[0]!;
}
