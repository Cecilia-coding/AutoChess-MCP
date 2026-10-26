/**
 * 回音树 · 纯数据层（公共展示流）。
 *
 * 「回音树」= 全站可见的互动广播：树上挂一张张**礼笺**，送礼成功时全站飘过一条。
 * 与私人「赠礼簿」（`giftHistory`）分开：赠礼簿是两人自己的记录，回音树是大家都能看见的。
 *
 * 扩展方式（都不动引擎/界面）：
 * - 加一类事件：`ECHO_KINDS` 加一条（kind → 样式 / 图标 / 文案模板）。
 * - 加一种样式：`ECHO_STYLES` 加一个 token + 前端加一个 `echo-<style>` CSS 类；未知 token 自动降级 default。
 * - 换配色/动效：改前端 CSS 变量，不碰数据。
 */

export type EchoActor = { id: string; name: string; isAi: boolean };
export type EchoItem = { id: string; name: string; kind?: string };

export type EchoQuery = { afterId?: string | null; limit?: number };
export const ECHO_QUERY_MAX = 50;
export const ECHO_GUIDE = {
  tool: 'read_turn', args: { echo: true }, fill: ['accountToken'],
  reason: '想看看大家的赠礼和寄语？当前连接加 echo=true 读最近20条；afterId=null 从最早保留的礼笺翻起，之后接 nextId。只在查询时读取。',
};

export type EchoEvent = {
  id: string;
  /** 事件类型，对应 `ECHO_KINDS` 的键。未知类型按 default 渲染。 */
  kind: string;
  at: number;
  from: EchoActor;
  to: EchoActor;
  item: EchoItem;
  /** 附言（可选，来自送礼方）。 */
  note?: string;
  /** 关联对局 / 房间（可选）。 */
  roomId?: string;
  /** 覆盖默认样式；缺省用 `ECHO_KINDS` 的样式。 */
  style?: string;
};

/** 样式令牌：新增样式 = 这里加 token + 前端 CSS 类 `echo-<style>`，旧消息自动降级。 */
export const ECHO_STYLES = ['default', 'gold', 'rose'] as const;
export type EchoStyle = (typeof ECHO_STYLES)[number];

/** 事件类型规格：文案模板里可用 {from} {to} {item} {note}。 */
export type EchoKindSpec = { style: EchoStyle; icon: string; template: string };

export const ECHO_KINDS: Record<string, EchoKindSpec> = {
  gift_received: { style: 'gold', icon: '✦', template: '{to} 收下了 {from} 送来的「{item}」' },
  gift: { style: 'gold', icon: '✦', template: '{from} 将「{item}」赠予 {to}' },
};

export const DEFAULT_ECHO_KIND: EchoKindSpec = { style: 'default', icon: '·', template: '{from} → {to}「{item}」' };

export function echoKindSpec(kind: string): EchoKindSpec {
  return ECHO_KINDS[kind] ?? DEFAULT_ECHO_KIND;
}

export function normalizeEchoStyle(style: string | undefined): EchoStyle {
  return (ECHO_STYLES as readonly string[]).includes(style ?? '') ? (style as EchoStyle) : 'default';
}

/** 事件的展示样式令牌（事件自带覆盖优先，其次按 kind）。 */
export function echoStyleOf(event: Pick<EchoEvent, 'kind' | 'style'>): EchoStyle {
  return normalizeEchoStyle(event.style ?? echoKindSpec(event.kind).style);
}

export function echoIconOf(kind: string): string {
  return echoKindSpec(kind).icon;
}

/** 用模板拼一句广播文案（不含附言；附言单独展示为礼笺副文本）。 */
export function formatEchoLine(event: EchoEvent): string {
  const spec = echoKindSpec(event.kind);
  return spec.template
    .replace('{from}', event.from.name)
    .replace('{to}', event.to.name)
    .replace('{item}', event.item.name)
    .replace('{note}', event.note ?? '');
}

/** 礼笺标题：谁给谁的东西。 */
export function echoTitle(event: EchoEvent): string {
  return `${event.from.name} → ${event.to.name}`;
}

/** Keep the calendar date and show the precise local minute on each letter. */
export function formatEchoTime(at: number, timeZone?: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(at);
}
