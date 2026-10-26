/**
 * 公告：给玩家与机的只读信息（大厅、局外 MCP 读工具共用）。
 * 加一条公告 = 加一条数据；`audience` 决定谁看到，`pinned` 置顶。
 */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  at: number;
  /** 受众：both 所有人 / human 仅玩家 / ai 仅机。默认 both。 */
  audience?: 'both' | 'human' | 'ai';
  pinned?: boolean;
};

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'echo-tree-open',
    title: '回音树开放',
    body: '从今天起，送礼成功会在回音树上留一张礼笺，并全站飘过一条。旧礼物照旧留在赠礼簿里，不补播。',
    at: Date.parse('2026-09-23T00:00:00+08:00'),
    audience: 'both',
    pinned: true,
  },
];

export function announcementsFor(audience: 'human' | 'ai'): Announcement[] {
  return ANNOUNCEMENTS
    .filter(item => !item.audience || item.audience === 'both' || item.audience === audience)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.at - a.at);
}
