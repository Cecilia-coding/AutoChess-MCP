/** 对对碰 · 试玩参数。正式开放前确认券来源、概率和积分价格；奖品按份保存。 */
import type { GiftPresentation } from './gift-presentation';
export type WheelReward =
  | { kind: 'coins'; currency: 'human' | 'bot'; amount: number }
  | { kind: 'tickets'; amount: number }
  | { kind: 'cosmetic'; cosmeticId: string };
export type WheelPrizeSpec = {
  id: string; name: string; icon: string; reward: WheelReward; giftable: boolean;
  presentation: { giftSkin: string; broadcastSkin: string };
};
export type Weighted<T> = { value: T; weight: number };
export type WheelRules = {
  id: string; preview: boolean; size: number; starterTickets: number;
  symbols: { id: string; name: string; icon: string; weight: number }[];
  matches: Record<'pair' | 'triple' | 'clear', { refund: number; points: number }>;
  luck: Weighted<number>[]; clearDrops: Weighted<string | null>[];
  prizes: WheelPrizeSpec[]; redemptions: { prizeId: string; points: number }[];
};
const presentation = { giftSkin: 'wheel-letter-v1', broadcastSkin: 'gold' };
export const WHEEL_DRAFT: WheelRules = {
  id: 'nine-grid-preview-v1', preview: true, size: 9, starterTickets: 30,
  symbols: [
    ['leaf','叶','🌿'], ['flower','花','🌸'], ['moon','月','🌙'],
    ['star','星','⭐'], ['cloud','云','☁️'], ['bird','鸟','🕊️'],
    ['shell','贝','🐚'], ['peach','桃','🍑'], ['bell','铃','🔔'],
  ].map(([id,name,icon]) => ({ id,name,icon,weight:1 })),
  matches: { pair: {refund:1,points:2}, triple:{refund:2,points:5}, clear:{refund:5,points:10} },
  luck: [{value:1,weight:90},{value:2,weight:9},{value:5,weight:1}],
  clearDrops: [{value:null,weight:80},{value:'bot-100',weight:10},{value:'tickets-2',weight:8},{value:'olive',weight:1},{value:'ivy',weight:1}],
  prizes: [
    {id:'bot-100',name:'100 bot 币',icon:'◈',reward:{kind:'coins',currency:'bot',amount:100},giftable:false,presentation},
    {id:'tickets-2',name:'抽奖券 ×2',icon:'🎟️',reward:{kind:'tickets',amount:2},giftable:false,presentation},
    {id:'olive',name:'灵橄 · 衔春',icon:'🕊️',reward:{kind:'cosmetic',cosmeticId:'frame-revival-olive'},giftable:true,presentation},
    {id:'ivy',name:'青藤 · 凌霄',icon:'🌿',reward:{kind:'cosmetic',cosmeticId:'frame-revival-ivy'},giftable:true,presentation},
    {id:'astrolabe',name:'时间星盘 · 异色',icon:'✦',reward:{kind:'cosmetic',cosmeticId:'skin-time-astrolabe'},giftable:true,presentation},
  ],
  redemptions: [{prizeId:'olive',points:200},{prizeId:'ivy',points:200},{prizeId:'astrolabe',points:500}],
};
export type WheelPrize = {
  id: string; spec: WheelPrizeSpec; at: number; source: 'clear' | 'points' | 'gift';
  status: 'pending' | 'used' | 'sent'; from?: {id:string;name:string};
  to?: {id:string;name:string}; note?: string; settledAt?: number;
};
export type WheelEvent = {
  kind: 'fill' | 'pair' | 'triple' | 'clear' | 'prize' | 'start' | 'use' | 'gift' | 'buy_tickets';
  slots?: number[]; symbols?: string[]; refund?: number; points?: number; multiplier?: number;
  prizeId?: string;
  tickets?:number; cost?:number; currency?:'human'|'bot';
};
export type WheelCommand = { action:'start'|'fill'|'redeem'|'use'|'gift'|'buy_tickets'; requestId:string; revision:number; count?:number; prizeId?:string; to?:string; note?:string };
export type WheelReceipt = {requestId:string;fingerprint:string;revision:number;events:WheelEvent[]};
export type WheelState = {
  rulesId:string; started:boolean; revision:number; tickets:number; points:number; totalPoints:number;
  board:(string|null)[]; prizes:WheelPrize[]; receipts:WheelReceipt[];
};
export type WheelView = {
  enabled:boolean; rules:WheelRules; state:Omit<WheelState,'receipts'>;
  guide?:typeof WHEEL_GUIDE;
  gifting?:{isAi:boolean;recipients:{id:string;username:string}[];presentation?:GiftPresentation;themes?:Record<string,string>;introductions?:Record<string,string>};
  giftDelivery?:{status:'delivered';viewState:'unreported';recipientName?:string;presentation:GiftPresentation};
  ticketShop?:{currency:'human'|'bot';currencyName:string;balance:number;ticketsPerPack:number;packPrice:number;maxTickets:number};
  recipientHint:string; receipt?:Omit<WheelReceipt,'fingerprint'>; replayed?:boolean;
};
export const WHEEL_GUIDE = {
  read:{tool:'read_turn',args:{wheel:true},fill:['accountToken']},
  act:{tool:'act',args:{kind:'wheel'},fill:['accountToken','requestId','revision','wheel']},
  actions:{start:'领取一次试玩券',buy_tickets:'count填券数（10的倍数，最多100）；价格和余额见ticketShop，仅花游戏币',fill:'补满空格；count=1可只补一格',redeem:'prizeId填rules.redemptions里的编号',use:'prizeId填state.prizes里待领外观的实例id；收到的礼物在领取后播报',gift:'prizeId填待领外观的实例id，可在顶层加note；收礼人固定为你的人类'},
  hint:'revision取state.revision；原单重试保持所有参数与requestId。币券直接到账；外观可自用或赠送。',
};
export const WHEEL_LIMITS = { prizes:1000, receipts:32 } as const;
export function emptyWheel(rules = WHEEL_DRAFT): WheelState {
  return {rulesId:rules.id,started:false,revision:0,tickets:0,points:0,totalPoints:0,board:Array(rules.size).fill(null),prizes:[],receipts:[]};
}
