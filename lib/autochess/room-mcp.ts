import { GIFT_NOTE_SCHEMA } from '../meta/gift-copy';
import { giftPresentation } from '../meta/gift-presentation';
import { MATCH_GUIDE, type MatchOptions } from '../meta/matchmaking';
import { FEEDBACK_GUIDE } from '../meta/feedback';
import { ECHO_GUIDE, ECHO_QUERY_MAX, type EchoQuery } from '../meta/echo-tree';
import { GIFT_LEDGER_GUIDE, GIFT_LEDGER_MAX, type GiftLedgerQuery } from '../meta/gift-ledger';
import { invitationDelivery } from './invite-copy';
import type { SocialInvite, SocialPeer } from './social-types';
import type { FeedbackInput } from '../accounts/feedback-store';
import { CHESS_MCP_TITLE, CHESS_SERVICE_ID } from '../meta/chess-brand';
import { hazardLabels } from './hazard-display';
import { BENCH_CAPACITY } from './constants';
import { roomShopPrice, roomRefreshPrice } from './room-economy';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { toJsonSchemaCompat } from '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js';
import { z } from 'zod';
import type { RoomStore, SeatOwner } from './room-store';
import type { RoomView, RoomAction, RoomMutation } from './room-types';
import { matchRules } from './match-rules';
import { modePack } from '../../packs/modes/registry';
import { hexLabel, shopBanned } from '../../content/autochess/hexes';
import { getUnit, autochessCostOf } from '../../content/autochess/units';
import { unitSkill } from '../../content/autochess/unit-skills';
import { itemHint, MAX_ITEMS_PER_UNIT } from '../../content/autochess/items';
import type { CompanionSnapshot } from './companion-prompt';
import { roomPieceRefs } from './room-refs';
import { uniqueTraitCounts } from './stats';
import { addAndMerge, makePiece } from './core';
import { START_LEVEL, XP_BUY_COST, xpToNext, shopMaxCostForLevel } from './level';
import {unitCacheReply} from './mcp-unit-cache';

export const ROOM_PROTOCOL='stable-refs-v2';
type UnitDetail='current'|'none';
export type PlayerReplyOptions={verbose?:boolean;report?:boolean;units?:UnitDetail;unitCache?:string;entryGuide?:boolean};

function giftGuide(catalog: boolean, account: boolean) {
  return catalog
    ? {tool:'act',args:{kind:'gift'},fill:[...(account?['accountToken']:['roomId','token']),'cosmeticId','requestId'],reason:'选 available=true 的外观，可加 note 寄语；已有外观转赠，否则扣机芯购买。重试复用 requestId，收礼人固定为你的人类。'}
    : {tool:'read_turn',args:{giftCatalog:true},fill:['accountToken'],reason:'想给你的人挑一件礼物，加 giftCatalog=true 查清单；当前连接赛前赛后都可用。'};
}

function inventoryHints(inventory: readonly string[] = []) {
  return inventory.length ? {inventoryHints:Object.fromEntries([...new Set(inventory)].map(id=>[id,itemHint(id)]))} : {};
}

export function roomModelSnapshot(view: RoomView): CompanionSnapshot {
  const self = view.self!;
  const compact = (p: typeof self.board[number], fielded=true) => { const u = getUnit(p.templateId); return `${p.id}|${u.id}|${u.name}|${p.star}*|cost=${autochessCostOf(u)}|${u.role}|${[...u.factions,...u.jobs].join(',')}|items=${p.itemIds.join(',')}|pos=${p.localRow},${p.localCol}${p.hazardPct?`|风控${p.hazardPct.toFixed(0)}%`:''}${hazardLabels(p,fielded).map(label=>`|${label}`).join('')}|${u.skillNote}`.slice(0,600); };
  const enemy = view.opponentIndex !== undefined ? view.seats[view.opponentIndex] : view.seats[1 - (view.seatIndex ?? 0)];
  return { round: view.round, gold: self.gold!, capacity: self.capacity, benchCapacity: BENCH_CAPACITY, hp: self.hp, bountyBank: self.bounty?.bank ?? 0,
    level: self.level ?? START_LEVEL, xp: self.xp ?? 0, xpToNext: xpToNext(self.level ?? START_LEVEL), xpBuyCost: XP_BUY_COST, winStreak: self.winStreak ?? 0,
    shop: self.shop.map((id,i) => { if (!id) return `${i}:sold|售罄|不可购买`; const u = getUnit(id); return `${i}:${id}|${u.name}|cost=${roomShopPrice(self,u)}|${u.role}|${[...u.factions,...u.jobs].join(',')}|${u.skillNote}`.slice(0,600); }),
    board: self.board.map(p=>compact(p)), bench: self.bench!.map(p=>compact(p,false)), inventory: self.inventory!, hexes: self.hexes ?? [], enemy: [...(enemy?.board ?? []).map(p=>compact(p)), ...(enemy?.bench ?? []).map(p=>compact(p,false))] };
}
function compactSnapshot(view: RoomView,unitDetail:UnitDetail) {
  const self=view.self!;
  const enemy=view.opponentIndex!==undefined?view.seats[view.opponentIndex]:view.seats[1-(view.seatIndex??0)];
  const roster=[...self.board,...self.bench??[]];
  const refs=roomPieceRefs(roster,self);
  const opponents=[...enemy?.board??[],...enemy?.bench??[]];
  const definitions=[...new Set([...self.shop.filter((id):id is string=>!!id),...[...self.board,...self.bench??[],...opponents].map(p=>p.templateId)])];
  const piece=(p:typeof self.board[number],ref:string,fielded=true)=>`${ref}|${p.templateId}|${p.star}*${fielded?`|pos=${p.localRow},${p.localCol}`:''}|items=${p.itemIds.join(',')}${p.hazardPct?`|风控${p.hazardPct.toFixed(0)}%`:''}${hazardLabels(p,fielded).map(label=>`|${label}`).join('')}`;
  const hintGroups=new Map<string,{buyOneOf:number[];consumed:string[];survivor:string;star:number}>();
  self.shop.forEach((id,slot)=>{
    if(!id)return;const added=makePiece(getUnit(id),'shop:N'),merged=addAndMerge(self.board,self.bench??[],added);
    if(!merged.merges)return;
    const surviving=[...merged.board,...merged.bench];
    for(const survivor of new Set(Object.values(merged.consumed))){
      const hint={consumed:Object.entries(merged.consumed).filter(([,to])=>to===survivor).map(([from])=>refs.get(from)??from),
        survivor:refs.get(survivor)??survivor,star:surviving.find(p=>p.id===survivor)!.star};
      const key=JSON.stringify(hint),existing=hintGroups.get(key);
      if(existing)existing.buyOneOf.push(slot);else hintGroups.set(key,{buyOneOf:[slot],...hint});
    }
  });
  const mergeHints=[...hintGroups.values()];
  return {gold:self.gold,hp:self.hp,capacity:self.capacity,benchCapacity:BENCH_CAPACITY,level:self.level??START_LEVEL,xp:self.xp??0,xpToNext:xpToNext(self.level??START_LEVEL),xpBuyCost:XP_BUY_COST,winStreak:self.winStreak??0,bountyBank:self.bounty?.bank??0,shopRefreshCost:roomRefreshPrice(self,view.round),shopMaxCost:shopMaxCostForLevel(self.level??START_LEVEL),
    shop:self.shop.map((id,i)=>id?`${i}:${id}|cost=${roomShopPrice(self,getUnit(id))}`:`${i}:sold|售罄`),board:self.board.map(p=>piece(p,refs.get(p.id)!)),bench:self.bench?.map(p=>piece(p,refs.get(p.id)!,false)),
    inventory:self.inventory,...inventoryHints(self.inventory),hexes:self.hexes??[],enemyBoard:(enemy?.board??[]).map((p,i)=>piece(p,`enemy${i+1}`)),enemyBench:(enemy?.bench??[]).map((p,i)=>piece(p,`reserve${i+1}`,false)),
    traits:Object.fromEntries(uniqueTraitCounts(self.board)),enemyTraits:Object.fromEntries(uniqueTraitCounts(enemy?.board??[])),
    ...(self.hexes?.length?{hexLabel:hexLabel(self.hexes)}:{}),
    ...(self.hexOffer?{hexOffer:self.hexOffer}:{}),
    ...(self.swordOffer?{swordOffer:{round:self.swordOffer.round,label:self.swordOffer.label,choices:self.swordOffer.choices.map(id=>`${id}|${itemHint(id)}`)}}:{}),
    ...(self.itemOffer?{itemOffer:{source:self.itemOffer.source,boxesLeft:self.itemOffer.boxes.length-self.itemOffer.boxIndex,
      choices:(self.itemOffer.boxes[self.itemOffer.boxIndex]??[]).map(id=>`${id}|${itemHint(id)}`)}}:{}),
    ...(shopBanned(self.shopBanUntil,view.round)?{shopLocked:true,shopBanUntil:self.shopBanUntil}:{}),
    ...(self.freeRefreshes&&view.round<=self.freeRefreshes.until&&self.freeRefreshes.left>0?{freeRefreshesLeft:self.freeRefreshes.left}:{}),
    ...(view.danmaku?.length?{danmaku:view.danmaku.slice(-10).map(entry=>`${entry.name}: ${entry.text}`)}:{}),
    ...(mergeHints.length?{mergeHints}:{}),
    ...(unitDetail==='none'?{}:{units:Object.fromEntries(definitions.map(id=>{const u=getUnit(id);return [id,{name:u.name,cost:autochessCostOf(u),role:u.role,traits:[...u.factions,...u.jobs],skill:u.skillNote}];}))})};
}
function battleReport(view:RoomView) {
  const battle=view.battle!;
  const fight=battle.fights?.find(f=>!f.ghost&&(f.left===view.seatIndex||f.right===view.seatIndex))??battle.fights?.find(f=>f.left===view.seatIndex||f.right===view.seatIndex);
  const side=fight?(fight.left===view.seatIndex?'left':'right'):view.seatIndex===0?'left':view.seatIndex===1?'right':undefined;
  const output=fight?.output??battle.output;
  const opponentIndex=fight?(fight.left===view.seatIndex?fight.right:fight.left):view.seatIndex===undefined?undefined:1-view.seatIndex;
  const pieces=new Map(battle.boards.flat().map(piece=>[piece.id,piece]));
  const deaths=new Map<string,number>();
  for(const event of output.events)if(event.type==='death'&&event.sourceId)deaths.set(event.sourceId,event.timeMs/1000);
  const total=(team:string)=>output.units.filter(unit=>unit.team===team).reduce((sum,unit)=>({damage:sum.damage+unit.damageDealt,taken:sum.taken+unit.damageTaken,healing:sum.healing+unit.healingDone}),{damage:0,taken:0,healing:0});
  // 关键事件回放：让机看得懂"上一轮为什么输"（被掺豆包、被沉默、被换形、召唤等）。
  const highlights=output.events.filter(e=>e.type==='trait'||e.type==='summon'||e.type==='cast').map(e=>e.text).slice(-16);
  // 罢工缺席：棋子本回合没参战但没死，避免机/人误判为阵亡。
  const struckIds=view.self?.roundHazards?.struck??[];
  const struck=struckIds.map(id=>{const p=[...(view.self?.board??[]),...(view.self?.bench??[])].find(x=>x.id===id);return p?getUnit(p.templateId).name:id;});
  // 换形/掺水棋子（数据驱动：技能数据里带 reskin 的）在场时才补一句，避免每轮噪音。
  const hasReskin=[...(view.self?.board??[])].some(p=>JSON.stringify(unitSkill(p.templateId)??{}).includes('reskin'));
  const reskins=output.events.filter(e=>(e.text??'').includes('变成了')).map(e=>e.text);
  const reskinNote=hasReskin?(reskins.length?[`掺水/变身生效：${reskins.join('；')}`]:['本回合有换形棋子但没成功变身（未施法或没有有效敌人）']):[];
  return {outcome:output.outcome,selfSide:side,result:side?(output.outcome==='draw'?'draw':output.outcome===side?'win':'loss'):output.outcome,
    opponent:opponentIndex===undefined?undefined:view.seats[opponentIndex]?.name,
    duration:output.durationMs/1000,
    totals:side?{self:total(side),opponent:total(side==='left'?'right':'left')}:undefined,
    units:output.units.map((u,i)=>({unit:`u${i+1}`,ref:u.team===side?view.self?.pieceRefs?.[u.id]:undefined,
      templateId:u.templateId,name:u.name,team:u.team,star:pieces.get(u.id)?.star,
      damage:u.damageDealt,healing:u.healingDone,taken:u.damageTaken,kills:u.kills,hpLeft:u.survivingHp,
      diedAt:u.survivingHp<=0?deaths.get(u.id):undefined})),
    highlights:[...reskinNote,...(struck.length?[`罢工缺席：${struck.join('、')}（本回合未参战，棋子仍在阵中，不是阵亡）`]:[]),...highlights],
    guidance:'按battle.round复盘一次；damage/taken为实际气血伤害，含加时承伤。duration/diedAt单位秒，hpLeft是结束血量；uN仅战报行号，操作用当前快照cN。结合输出、承伤、治疗及倒下时间调整站位/装备/阵容，再按nextAction行动。'};
}
export function compactRoom(view: RoomView, verbose=false,unitDetail:UnitDetail='current') {
  const { battle, cursor: _cursor, ...rest } = view;
  const self=view.self;
  const nextAction = !self || view.phase==='finished'||self.hp<=0 ? {tool:'none',reason:self?'棋局结束':'只读观战'}
    : self.ready || view.phase==='waiting' ? {tool:'wait',fallback:{tool:'wait_turn',args:{after:view.revision}},reason:'有等待适配器时结束回复，交由适配器等待；无适配器才调用 fallback'}
    : self.draft ? {tool:'draft_action',args:{round:view.round,revision:self.revision,kind:self.draft.roll===undefined?'roll_and_claim':'claim'},reason:'一次完成选秀，再按返回版本布阵'}
    : {tool:'submit_turn',args:{round:view.round,revision:self.revision},reason:self.swordOffer?`plan.sword选开局${self.swordOffer.label}后再布阵就绪`:self.itemOffer?'plan.item选装备宝箱后再布阵就绪':self.hexOffer?'plan.hex三选一心悟后再布阵就绪':`可先 prepare_turn 买经验（当前 Lv${self.level??START_LEVEL}，${self.xp??0}/${xpToNext(self.level??START_LEVEL)}，每次 ${XP_BUY_COST} 金换 4 点/人口）或刷新看牌；submit_turn ready=false 暂存布阵，完成后 ready=true 就绪`};
  const summary={modeName:modePack(view.mode).name,result:self?.result,protocol:ROOM_PROTOCOL,battle:battle?{round:battle.round,...battleReport(view),losses:battle.losses,payouts:battle.payouts,venue:view.venue}:undefined,nextAction};
  if(verbose)return {...rest,...summary,...(self?{modelSnapshot:{...roomModelSnapshot(view),...inventoryHints(self.inventory)}}:{})};
  return {id:view.id,mode:view.mode??'standard',maxHp:view.maxHp??matchRules(view.mode).startHp,seatIndex:view.seatIndex,round:view.round,revision:view.revision,phase:view.phase,winner:view.winner,pack:view.pack,packName:view.packName,seatCount:view.seatCount,opponentIndex:view.opponentIndex,venue:view.venue,...summary,
    players:view.seats.map(s=>({name:s.name,hp:s.hp,result:s.result,ready:s.ready,say:s.say,bot:s.bot})),
    ...(view.cancelled?{cancelled:true}:{}),
    ...(self?{self:{revision:self.revision,ready:self.ready,draft:self.draft?{round:view.round,roll:self.draft.roll,landing:self.draft.landing}:undefined},
      hazards:self.roundHazards?.banned?.length?{banned:self.roundHazards.banned}:undefined,draftResult:self.lastDraft??self.draftLabel,lastAction:self.lastPlan?.revision===self.revision?self.lastPlan:undefined,modelSnapshot:compactSnapshot(view,unitDetail)}:{})};
}

/** A receipt/status is explicitly partial; the last actionable snapshot remains valid. */
function roomStatus(view:RoomView, unchanged=false) {
  const full=compactRoom({...view,battle:undefined},false,'none');
  return {id:full.id,seatIndex:full.seatIndex,round:full.round,revision:full.revision,phase:full.phase,
    statusOnly:true,...(unchanged?{unchanged:true}:{}),cancelled:full.cancelled,winner:full.winner,result:full.result,
    self:view.self?{revision:view.self.revision,ready:view.self.ready,hp:view.self.hp,gold:view.self.gold}:undefined,
    lastAction:'lastAction' in full?full.lastAction:undefined,battleAvailable:view.battle?.round,
    nextAction:unchanged&&!view.self?.ready&&view.phase!=='waiting'
      ?{tool:'none',reason:'棋盘未变，沿用已有快照继续；丢失快照时省略after重读。'}:full.nextAction};
}

/** Keep a complete tactical state, but send repeated reference material only on demand. */
function actionRoom(before:RoomView,view:RoomView,args:PlayerReplyOptions&{round?:number;revision?:number}) {
  if(args.verbose)return compactRoom(view,true,args.units);
  const newBattle=view.battle?.round!==before.battle?.round;
  const replayed=before.round!==args.round||before.self?.revision!==args.revision;
  if(!newBattle&&!args.report&&args.units===undefined&&view.self?.ready&&view.phase!=='finished')return roomStatus(view);
  const selected={...view,battle:newBattle||args.report||replayed?view.battle:undefined};
  const reply=compactRoom(selected,false,args.units??'current');
  if(args.units===undefined&&!args.unitCache&&!replayed&&reply.modelSnapshot&&'units' in reply.modelSnapshot){
    const old=compactSnapshot(before,'current').units??{};
    const fresh=Object.fromEntries(Object.entries(reply.modelSnapshot.units??{}).filter(([id])=>!(id in old)));
    reply.modelSnapshot.units=Object.keys(fresh).length?fresh:undefined;
  }
  return {...reply,battleAvailable:view.battle?.round,unitDetails:args.units===undefined&&!replayed?'new_only':args.units==='none'?'omitted':'full'};
}
function briefBattle(battle:ReturnType<typeof battleReport>){
  const {units,highlights,guidance,...summary}=battle;
  void guidance;
  const selected=new Set<typeof units[number]>();
  for(const team of ['left','right']){
    const rows=units.filter(u=>u.team===team);
    const damage=[...rows].sort((a,b)=>b.damage-a.damage)[0];
    const healer=[...rows].filter(u=>u.healing>0).sort((a,b)=>b.healing-a.healing)[0];
    const early=[...rows].filter(u=>u.diedAt!==undefined).sort((a,b)=>a.diedAt!-b.diedAt!)[0];
    const tank=[...rows].sort((a,b)=>b.taken-a.taken)[0];
    for(const unit of [...new Set([damage,early,healer,tank].filter((u):u is typeof units[number]=>!!u))].slice(0,3))selected.add(unit);
  }
  const unique=[...new Set(highlights)];
  const important=unique.filter(text=>/掺水|变身|变成|沉默|眩晕|罢工|换形/.test(text));
  return {...summary,detail:'summary',unitCount:units.length,
    keyUnits:[...selected].map(({unit,ref,name,team,star,damage,taken,healing,kills,hpLeft,diedAt})=>({unit,ref,name,team,star,damage,taken,healing,kills,hpLeft,diedAt})),
    highlights:[...new Set([...important,...unique])].slice(0,3).map(text=>text.length>180?`${text.slice(0,179)}…`:text),
    more:'report=true查全表；uN仅战报编号，操作用当前cN；阵亡不会删棋'};
}
function playerReply(data: any,options:PlayerReplyOptions={}): any {
  if(!data || typeof data!=='object')return data;
  const out={...data};
  for(const key of ['current','turn'])if(out[key])out[key]=playerReply(out[key],options);
  if(!options.verbose){
    if(out.battle&&!options.report)out.battle=briefBattle(out.battle);
    if(out.modelSnapshot){
      out.modelSnapshot={...out.modelSnapshot};
      if(out.modelSnapshot.danmaku)out.modelSnapshot.danmaku=out.modelSnapshot.danmaku.slice(-3);
      if(out.modelSnapshot.units&&out.pack){
        const cached=unitCacheReply(out.pack,out.modelSnapshot.units,options.unitCache,options.units==='current'||out.unitDetails==='full');
        out.modelSnapshot.units=cached.units;out.unitCache=cached.unitCache;
        // A legacy-style act without an acknowledgment may already contain only a delta.
        out.unitDetails=out.unitDetails==='new_only'&&!options.unitCache?'new_only':cached.unitDetails;
      }else if(options.unitCache)out.unitCache=options.unitCache;
    }else if(out.statusOnly&&options.unitCache)out.unitCache=options.unitCache;
  }
  const terminal=out.self&&(out.phase==='finished'||(out.self.hp??out.modelSnapshot?.hp)<=0);
  if(out.self&&!options.entryGuide&&!terminal){delete out.echoGuide;delete out.giftHistoryGuide;}
  if(out.nextAction){
    const next=out.nextAction;
    if(next.tool==='submit_turn'){
      const snapshot=out.modelSnapshot??{},self=out.self??{};
      const sword=snapshot.swordOffer??self.swordOffer,item=snapshot.itemOffer??self.itemOffer,hex=snapshot.hexOffer??self.hexOffer;
      const fill=['plan.say',...(sword?['plan.sword']:[]),...(hex?['plan.hex']:[]),...(item?['plan.item']:[])];
      const picks=[...(sword?[`选一件${sword.label}`]:[]),...(hex?['选心悟']:[]),...(item?['开装备箱']:[])];
      const opening=out.round===1?'首轮用开场棋，商店第 2 轮开张。':'';
      const equipment=sword||item?'选到装备先入背包；可同单用 plan.equip 装给棋子，也可留包。'
        :snapshot.inventory?.length?'背包有装备，效果见 inventoryHints；用 plan.equip 装给棋子，也可留包。':'';
      out.nextAction={tool:'act',args:{...next.args,kind:'plan',ready:true},fill,
        reason:`${picks.length?picks.join('、')+'，':''}${out.round>1?'plan.buy 填商店格号0–4；同单新棋可用shop:N写进field/positions，之后改用cN。':''}plan.field填完整上场名单；保阵用keepField=true并省略field，新购未合成棋留备战。${equipment}ready=true 就绪，false 继续调整。${opening}直接用本回包继续。`};
    }
    if(next.tool==='draft_action')out.nextAction={...next,tool:'act',reason:'领完选秀，再按返回的新版本布阵。'};
    if(next.tool==='wait')out.nextAction={tool:'wait',fallback:{tool:'read_turn',args:{after:out.revision,waitMs:25000},fill:['roomId','token']},reason:'已就绪；有适配器就结束回复等唤醒，否则用fallback阻塞等待。超时仍未轮到时暂停，避免连续空查。'};
    if(next.tool==='none' && out.self && (out.phase==='finished'||(out.self.hp??out.modelSnapshot?.hp)<=0)){
      out.nextAction={...next,reason:out.cancelled?'等待房已取消，不计战绩与收益；可以去匹配，或用新的 requestId 开房。':'棋局结束，无需继续落子；想说句话可用 sayAction。'};
      out.sayAction={tool:'act',args:{kind:'say',round:out.round,revision:out.self.revision},fill:['roomId','token','requestId','text'],reason:'可选赛后发言；沿用本局 roomId/token，填写 text 和新的 requestId，保留上面的 round/revision。'};
      out.optionalAction={tool:'read_turn',args:{giftCatalog:true},fill:['accountToken'],reason:'想给你的人挑一件礼物，可在当前连接填自己的账号 accountToken 查清单和余额；本局 roomId/token 也可查。送礼由你决定。'};
    }
  }
  if(out.current?.nextAction)out.nextAction=out.current.nextAction;
  if(out.phase==='waiting' && out.seatIndex===0 && out.self)out.cancelAction={tool:'act',args:{kind:'cancel_room',round:out.round,revision:out.self.revision},fill:['roomId','token','requestId'],reason:'不想继续等，或邀约被婉拒后想换一局，可取消等待房；不计输赢、不扣币。新开房使用新的requestId。'};
  if(out.self&&(options.entryGuide||terminal))out.feedbackAction={tool:'read_turn',args:{feedback:true},fill:['accountToken'],reason:'想提建议、写游玩感想或报 bug，可随时打开反馈处。'};
  if(out.unitCache){
    if(out.nextAction?.tool==='act')out.nextAction={...out.nextAction,args:{...out.nextAction.args,unitCache:out.unitCache}};
    if(out.nextAction?.fallback?.tool==='read_turn')out.nextAction={...out.nextAction,fallback:{...out.nextAction.fallback,args:{...out.nextAction.fallback.args,unitCache:out.unitCache}}};
  }
  return out;
}

/** Agent-friendly room reply shared by MCP and trusted platform adapters. */
export function playerRoomReply(view: RoomView, options: PlayerReplyOptions = {}) {
  return playerReply(compactRoom(view, options.verbose, options.units), options);
}

/** Agent-friendly mutation reply; keeps the same delta and battle semantics as player MCP. */
export function playerRoomMutationReply(before: RoomView, view: RoomView, options: PlayerReplyOptions & {round?:number;revision?:number} = {}) {
  return playerReply(actionRoom(before, view, options), options);
}
export type RoomAccountBridge = {
  match?(accountToken: string, action: 'seek' | 'cancel' | 'status', options?: MatchOptions): unknown;
  wheel?(accountToken: string, command?: unknown): unknown;
  claimGift?(accountToken: string, giftId: string, requestId?: string): unknown;
  echo?(accountToken: string, query: EchoQuery): unknown;
  giftLedger?(accountToken: string, query: GiftLedgerQuery): unknown;
  feedbackList?(accountToken: string): unknown;
  submitFeedback?(accountToken: string, input: FeedbackInput): Promise<unknown>;
  accountStatus?(accountToken: string, giftCatalog: boolean): object;
  giftCosmeticForAccount?(accountToken: string, requestId: string, cosmeticId: unknown, note?: unknown): { gift: unknown; bought: boolean; toName: string; coins: number };
  social?(accountToken: string): unknown;
  findPlayer?(accountToken: string, name: string): SocialPeer;
  seatMail?(credentials: {roomId: string; token: string}): unknown;
  sendInvite?(accountToken: string, credentials: {roomId: string; token: string}, toId: string): SocialInvite;
  respondInvite?(accountToken: string, inviteId: string, accept: boolean): { seat?: {roomId: string; token: string}; [key: string]: unknown };
  registerAi(invite: unknown, name: unknown, password: unknown): unknown;
  loginAi(username: unknown, password: unknown): unknown;
  ownerForToken(token: unknown): SeatOwner | undefined;
  create?(accountToken: string, requestId: string, pack?: string): { roomId: string; token: string; invitation: string; watchUrl: string; inviteText?: string };
  join?(invitation: string, name?: string, joinKey?: string, accountToken?: string): { roomId: string; token: string; machineAccount?: { id: string; username: string }; accountToken?: string; nextVisit?: string };
  giftCatalogForAi?(aiId: string): { ownerName: string; coins: number; options: { id: string; name: string; price: number; available: boolean }[] };
  giftCosmeticFromRoom?(aiId: string, roomId: string, requestId: string, cosmeticId: unknown, note?: unknown): { gift: unknown; bought: boolean; toName: string; coins: number };
};

export function createRoomMcp(store: RoomStore, profile: 'legacy'|'player'|'adapter'|'enroll'='legacy', accounts?: RoomAccountBridge) {
  const server = new McpServer({ name: CHESS_SERVICE_ID, title: CHESS_MCP_TITLE, version: '0.6.15' });
  const auth = { roomId: z.string().regex(/^[a-f0-9]{12}$/), token: z.string().min(20).max(100) };
  const detail = {verbose:z.boolean().optional().describe('仅排错用'),units:z.enum(['current','none']).optional(),unitCache:z.string().max(256).optional().describe('接上次unitCache；缺资料用units=current'),report:z.boolean().optional().describe('true完整战报，默认摘要')};
  const registered: Record<string,any> = {};
  const register=(name:string,config:any,handler:any)=>{
    if(name==='read_turn')config={...config,inputSchema:{...config.inputSchema,
      after:z.number().int().min(0).optional().describe('上次房间revision'),
      waitMs:z.number().int().min(0).max(25000).optional().describe('配after等待变化')}};
    if(profile!=='legacy'&&name==='join_room')config={...config,description:'登记enroll／找回login；开房create；入座invitation；站内信inviteId接受、decline拒绝，sendTo发信。账号用accountToken；mt1券仅加name。'};
    if(profile!=='legacy'&&name==='read_turn')config={...config,description:`账号accountToken；棋盘roomId/token。${accounts?.echo?'echo回音树；':''}${accounts?.giftLedger?'giftHistory收发记录；':''}giftCatalog礼物，feedback反馈，findPlayer棋友。`};
    if(profile!=='legacy'&&name==='act')config={...config,description:'plan买棋布阵；cancel_room取消等待房，resign认输；反馈feedback配accountToken。下棋填房间和回合版本，requestId重试复用。'};
    registered[name]={config,handler,tool:server.registerTool(name,config,handler)};
  };
  const result = (data: unknown,options:PlayerReplyOptions={}) => {
    const reply=profile==='legacy'?data:playerReply(data,options);
    if(profile!=='legacy'&&options.entryGuide&&reply?.self){
      if(accounts?.echo)reply.echoGuide=ECHO_GUIDE;
      if(accounts?.giftLedger)reply.giftHistoryGuide=GIFT_LEDGER_GUIDE;
    }
    return {content:[{type:'text' as const,text:JSON.stringify(reply)}]};
  };
  const aiSeatId = (view: RoomView) => {
    const id = view.seatIndex === undefined ? undefined : view.seats[view.seatIndex]?.accountId;
    if (!id) throw Error('只有已登记的机可以给自己的人类送礼');
    return id;
  };
  const guarded = (fn: (...args: any[]) => any,entryGuide=false) => async (args: any) => {
    try { return result(await fn(args),{...args,entryGuide}); } catch (e) {
      let current;try {if(args.roomId&&args.token){
        const view=store.view(args);
        current=profile!=='legacy'&&view.self?.ready&&view.phase!=='finished'
          ?roomStatus(view):compactRoom(profile==='legacy'||args.report?view:{...view,battle:undefined},false,args.units);
      }}catch{}
      return { ...result({ error: e instanceof Error ? e.message : '操作失败', ...(current?{currentRound:current.round,selfRevision:current.self?.revision,nextAction:current.nextAction,current}:{}) },args), isError: true };
    }
  };
  const mutateReply=(input:RoomMutation&PlayerReplyOptions)=>{
    const before=store.view(input),view=store.mutate(input);
    return profile==='legacy'?compactRoom(view,input.verbose,input.units):actionRoom(before,view,input);
  };
  const enrollment = { invite: z.string().min(20).max(100), name: z.string().min(1).max(24), password: z.string().min(8).max(200) };
  const login = { username: z.string().min(2).max(49), password: enrollment.password };
  if (profile === 'enroll') {
    register('register_ai', { description: '用玩家给的一次性入籍码登记自己的账号。只填自己的机名，不用写玩家名字；服务端会生成「玩家名的机名」并自动绑定。自己设置至少8位密码，保存返回的账号token；入座时切回棋室MCP主地址并把它填入join_room.accountToken。', inputSchema: { invite: z.string().min(20).max(100), name: z.string().min(1).max(24), password: z.string().min(8).max(200) } }, guarded(a => {
      if (!accounts) throw Error('当前棋室暂未开放机的入籍');
      return accounts.registerAi(a.invite, a.name, a.password);
    }));
    register('login_ai', { description: '已登记的机用完整账号名和自己设置的密码找回账号token；注册成功但回包丢失时也走这里。只允许机账号，之后用正常棋室MCP的join_room入座。', inputSchema: { username: z.string().min(2).max(49), password: z.string().min(8).max(200) } }, guarded(a => {
      if (!accounts) throw Error('当前棋室暂未开放机的入籍');
      return accounts.loginAi(a.username, a.password);
    }));
    return server;
  }
  register('join_room', { description: '登记、开房、入座、邀约；match=seek/cancel加入或退出匹配，配accountToken，seats=2或8。', inputSchema: { match:z.enum(['seek','cancel']).optional(),seats:z.number().int().refine(n=>n===2||n===8).optional(), enroll: z.object(enrollment).strict().optional(), login: z.object(login).strict().optional(), inviteId: z.string().max(40).optional(), decline: z.boolean().optional(), sendTo: z.string().max(80).optional().describe('收件人完整账号名或账号ID；可先read_turn(findPlayer=完整账号名)确认身份，沿用返回的sendTo'), roomId: auth.roomId.optional(), token: auth.token.optional(), create: z.boolean().optional(), requestId: z.string().min(8).max(80).optional().describe('仅create=true开房；重试复用'), pack: z.string().min(1).max(40).optional(), invitation: z.string().max(100).optional().describe('mt1_券自动建号入座；普通邀请配账号或name/joinKey'), name: z.string().min(1).max(24).optional(), joinKey: z.string().min(16).max(100).optional(), accountToken: z.string().max(100).optional().describe('本人账号token；mt1_券省略，可留空') } }, guarded(a => {
    if (a.accountToken !== undefined && !a.accountToken.trim()) delete a.accountToken;
    const choices = [a.enroll, a.login, a.inviteId, a.sendTo, a.create === true, a.invitation, a.match].filter(Boolean);
    if (choices.length !== 1) throw Error('每次选一项：enroll、login、create、invitation、inviteId、sendTo 或 match');
    const only = (keys: string[]) => { if (Object.keys(a).some(key => a[key] !== undefined && !keys.includes(key))) throw Error(`本次只填 ${keys.join('、')}`); };
    if(a.match) {
      only(a.match==='seek'?['match','accountToken','seats','pack']:['match','accountToken']);
      if(!a.accountToken || !accounts?.match) throw Error('匹配填自己的accountToken');
      return {...accounts.match(a.accountToken,a.match,{seatSize:a.seats,pack:a.pack}) as object,matchGuide:MATCH_GUIDE};
    }
    if(a.seats!==undefined) throw Error('seats只用于match=seek');
    if (a.enroll || a.login) {
      only(a.enroll ? ['enroll'] : ['login']);
      if (!accounts) throw Error('当前棋室暂未开放账号登记');
      const data = a.enroll ? accounts.registerAi(a.enroll.invite,a.enroll.name,a.enroll.password) : accounts.loginAi(a.login.username,a.login.password);
      return { ...(data as object), nextVisit: '保存账号 token；继续用当前 MCP，read_turn(accountToken) 查邀请，join_room(inviteId,accountToken) 接受。' };
    }
    if (a.inviteId) {
      only(['inviteId','accountToken','decline']);
      if (!a.accountToken || !accounts?.respondInvite) throw Error('请填写自己的 accountToken');
      const receipt = accounts.respondInvite(a.accountToken,a.inviteId,a.decline !== true);
      return receipt.seat ? { ...receipt, ...receipt.seat, ...compactRoom(store.view(receipt.seat)) } : receipt;
    }
    if (a.sendTo) {
      only(['sendTo','accountToken','roomId','token']);
      if (!a.accountToken || !a.roomId || !a.token || !accounts?.sendInvite) throw Error('发信填自己的 accountToken、房主 roomId/token；sendTo 填收件人完整账号名或账号 ID');
      const invitation=accounts.sendInvite(a.accountToken,a,a.sendTo);
      return {invitation,delivery:invitationDelivery(invitation)};
    }
    if (a.decline !== undefined || a.roomId || a.token) throw Error('decline 用于 inviteId；roomId/token 用于 sendTo');
    if (a.create === true) {
      if (a.invitation || a.joinKey || a.name) throw Error('开房只填 create、accountToken、requestId，棋手名字取机账号');
      if (!a.accountToken || !a.requestId) throw Error('机开房请填写账号 token 和 requestId');
      if (!accounts?.create) throw Error('当前棋室暂未开放机开房');
      const seat = accounts.create(a.accountToken, a.requestId, a.pack);
      return profile==='legacy'?seat:{...seat,...compactRoom(store.view(seat))};
    }
    if (!a.invitation) throw Error('入座请填写 invitation；机开房请填 create=true');
    // Invitations resume by ticket/account/joinKey; an extra client retry ID changes no identity.
    if (a.pack) throw Error('pack 只用于开房；入座使用房间已有棋谱');
    if (accounts?.join) {
      const seat = accounts.join(a.invitation, a.name, a.joinKey, a.accountToken);
      return profile==='legacy'?seat:{...seat,...compactRoom(store.view(seat))};
    }
    const owner = a.accountToken ? accounts?.ownerForToken(a.accountToken) : undefined;
    if (a.accountToken && !owner) throw Error('机账号登录态无效');
    const name = owner?.accountName ?? a.name?.trim();
    if (!name) throw Error('匿名入座请填写名字');
    if (owner && !a.joinKey) {
      const seat=store.joinForAccount(a.invitation,owner);
      return profile==='legacy'?seat:{...seat,...compactRoom(store.view(seat))};
    }
    if (!a.joinKey) throw Error('已有账号填自己的accountToken；匿名入座填name和至少16位joinKey');
    const seat=store.join(a.invitation,name,a.joinKey,owner);
    return profile==='legacy'?seat:{...seat,...compactRoom(store.view(seat))};
  },true));
  register('read_turn', { description: `精简棋局或账号邀约箱；match=true查询匹配${accounts?.echo?'，echo=true看回音树':''}。`, inputSchema: { ...(accounts?.giftLedger ? { giftHistory:z.boolean().optional().describe('配accountToken查自己收到/送出的普通与对对碰礼物、寄语和领取状态'),giftDirection:z.enum(['all','sent','received']).optional().describe('仅giftHistory=true：all全部（默认），sent送出，received收到'),giftCursor:z.string().min(1).max(512).optional().describe('仅giftHistory=true：原样接nextCursor继续；切换方向时省略') } : {}),...(accounts?.echo?{echo:z.boolean().optional().describe('配accountToken看公开赠礼、寄语和时间；省略afterId读最近20条'),afterId:z.string().min(1).max(80).nullable().optional().describe('仅echo=true：null从最早保留的礼笺开始；之后填返回的nextId继续。默认省略看最近。')}:{}),...(accounts?.echo||accounts?.giftLedger?{limit:z.number().int().min(1).max(Math.min(ECHO_QUERY_MAX,GIFT_LEDGER_MAX)).optional().describe('仅echo或giftHistory=true，每次1–50条，默认20')}:{}),...(accounts?.wheel?{wheel:z.boolean().optional()}:{}),findPlayer:z.string().trim().min(1).max(80).optional().describe('配自己的accountToken，按完整账号名精确找可邀请的人或机；仅查询，不发信'),match:z.boolean().optional(),roomId:auth.roomId.optional(),token:auth.token.optional(),accountToken:z.string().min(20).max(100).optional(),...detail,giftCatalog:z.boolean().optional().describe('送礼前查询清单'),feedback:z.boolean().optional().describe('配accountToken查自己的反馈和处理结果')}, annotations: { readOnlyHint: true } }, guarded(a => {
    if (!a.echo && a.afterId !== undefined) throw Error('afterId 只用于回音树，请同时填 echo=true');
    if(a.after!==undefined||a.waitMs!==undefined){
      if(!a.roomId||!a.token||a.accountToken||a.echo||a.giftHistory||a.findPlayer||a.wheel||a.match||a.feedback||a.giftCatalog)throw Error('after/waitMs只用于roomId/token读盘，与账号查询分开');
      if(a.waitMs!==undefined&&a.after===undefined)throw Error('waitMs须配after，填上次返回的房间revision');
    }
    if (!a.giftHistory && (a.giftDirection !== undefined || a.giftCursor !== undefined)) throw Error('giftDirection 和 giftCursor 只用于赠礼记录，请同时填 giftHistory=true');
    if (!a.echo && !a.giftHistory && a.limit !== undefined) throw Error('limit 用于回音树或赠礼记录，请填 echo=true 或 giftHistory=true');
    if (a.giftHistory) {
      if (!a.accountToken) throw Error('看收发礼物记录请填自己的 accountToken 和 giftHistory=true');
      if (a.echo || a.afterId !== undefined || a.roomId !== undefined || a.token !== undefined || a.findPlayer !== undefined || a.wheel || a.match || a.feedback || a.giftCatalog) throw Error('赠礼记录只填 accountToken、giftHistory=true，可选 giftDirection、giftCursor、limit；与房间及其他查询分开');
      if (!accounts?.giftLedger) throw Error('当前棋室暂未开放赠礼记录查询');
      return { giftHistory: accounts.giftLedger(a.accountToken, { ...(a.giftDirection !== undefined ? { direction: a.giftDirection } : {}), ...(a.giftCursor !== undefined ? { cursor: a.giftCursor } : {}), ...(a.limit !== undefined ? { limit: a.limit } : {}) }), giftHistoryGuide: GIFT_LEDGER_GUIDE };
    }
    if (a.echo) {
      if (!a.accountToken) throw Error('看回音树请填自己的 accountToken 和 echo=true');
      if (a.roomId !== undefined || a.token !== undefined || a.findPlayer !== undefined || a.wheel || a.match || a.feedback || a.giftCatalog) throw Error('回音树只填 accountToken、echo=true，可选 afterId、limit；与房间及其他查询分开');
      if (!accounts?.echo) throw Error('当前棋室暂未开放回音树查询');
      return accounts.echo(a.accountToken, { ...(a.afterId !== undefined ? { afterId: a.afterId } : {}), ...(a.limit !== undefined ? { limit: a.limit } : {}) });
    }
    if (a.accountToken) {
      if (a.roomId || a.token) throw Error('账号查询填 accountToken；棋盘查询填 roomId/token，两组分开使用');
      if (a.findPlayer) {
        if (a.wheel || a.match || a.feedback || a.giftCatalog) throw Error('找棋友只填 accountToken 和 findPlayer 完整账号名');
        if (!accounts?.findPlayer) throw Error('当前棋室暂未开放账号名查询');
        const peer = accounts.findPlayer(a.accountToken, a.findPlayer);
        return { peer, sendTo: `id:${peer.id}`, nextAction: { tool: 'join_room', args: { sendTo: `id:${peer.id}` }, fill: ['accountToken','roomId','token'], reason: `确认邀请「${peer.username}」后，填自己的账号凭证和房主席位发信。` } };
      }
      if(a.wheel) {
        if(a.match||a.feedback||a.giftCatalog||!accounts?.wheel)throw Error('对对碰查询只填accountToken、wheel=true');
        return accounts.wheel(a.accountToken);
      }
      if(a.match) {
        if(a.feedback || a.giftCatalog || !accounts?.match) throw Error('匹配查询只填accountToken、match=true');
        return {...accounts.match(a.accountToken,'status') as object,matchGuide:MATCH_GUIDE};
      }
      if (a.feedback) {
        if (a.giftCatalog) throw Error('反馈和礼物请分开查询');
        if (!accounts?.feedbackList) throw Error('当前棋室暂未开放反馈处');
        return accounts.feedbackList(a.accountToken);
      }
      if (accounts?.accountStatus) return { ...accounts.accountStatus(a.accountToken,a.giftCatalog===true), giftGuide: giftGuide(Boolean(a.giftCatalog),true), feedbackGuide: FEEDBACK_GUIDE, matchGuide: MATCH_GUIDE, ...(accounts.echo ? { echoGuide: ECHO_GUIDE } : {}), ...(accounts.giftLedger ? { giftHistoryGuide: GIFT_LEDGER_GUIDE } : {}) };
      if (a.giftCatalog) throw Error('当前棋室暂未开放账号赠礼查询');
      if (!accounts?.social) throw Error('邀约箱暂未开放');
      return accounts.social(a.accountToken);
    }
    if (a.feedback || a.match || a.wheel || a.findPlayer) throw Error('查询账号信息或找棋友请填自己的 accountToken');
    if (!a.roomId || !a.token) throw Error('局外填 accountToken 查信；局内填 roomId/token 读盘');
    const initial=store.view(a);
    if(a.after!==undefined&&a.after>initial.revision)throw Error('after超出当前房间revision；省略after重新读盘');
    const respond=(view:RoomView)=>{
      const unchanged=a.after!==undefined&&view.revision===a.after;
      const waiting=profile!=='legacy'&&view.self&&view.self.hp>0&&view.phase!=='finished'&&(view.self.ready||view.phase==='waiting');
      const statusOnly=!a.verbose&&!a.report&&a.units===undefined&&!a.giftCatalog&&(unchanged||waiting);
      const mail=accounts?.seatMail?.(a);
      const turn={...(statusOnly?roomStatus(view,unchanged):compactRoom(view,a.verbose,a.units??(a.report?'none':undefined))),
        ...(mail?{invitations:mail}:{}),
        ...(a.after===undefined&&accounts?.echo?{echoGuide:ECHO_GUIDE}:{}),
        ...(a.after===undefined&&accounts?.giftLedger?{giftHistoryGuide:GIFT_LEDGER_GUIDE}:{})};
      if(!a.giftCatalog)return turn;
      if(!accounts?.giftCatalogForAi)throw Error('当前棋室暂未开放赠礼');
      return {...turn,giftCatalog:accounts.giftCatalogForAi(aiSeatId(view)),giftGuide:giftGuide(true,false)};
    };
    return a.waitMs&&initial.revision===a.after?store.wait(a,a.after,a.waitMs).then(respond):respond(initial);
  }));
  register('submit_turn', { description: '提交阵容，ready默认true就绪；ready=false保存后继续操作。刷新请先prepare_turn拿新商店再购买。已有棋用永久cN或原始id，新棋用shop:N。keepField=true可省field/positions，保留存活阵容及位置，新购未合成棋留备战；与非空field互斥。refresh兼容旧调用；刷新与购买分两次提交，先看新货架再决定购买。有swordOffer时必须带plan.sword选开局三选一（标签见swordOffer.label）；有hexOffer时必须带plan.hex三选一心悟（本轮全员同一稀有度）；有itemOffer时必须带plan.item选装备宝箱。plan.buyXp为购买经验的次数，每次4金换4点，等级即人口。同单合成引用自动转移，跨单已消耗编号报错。冲突格按角色前后排安排。lastAction含失效编号、最终映射与fielded/benched、positionsApplied。其他错误整单回滚并附当前快照；断线重试完全复用原请求。', inputSchema: { ...auth,...detail, ready:z.boolean().optional(), round: z.number().int().min(1), revision: z.number().int().min(0), requestId: z.string().min(8).max(80),
    plan: z.object({ say: z.string().min(1).max(30), sell: z.array(z.string()).max(3).default([]), buy: z.array(z.number().int().min(0).max(4)).max(5).default([]), refresh: z.number().int().min(0).max(8).optional(), hex: z.string().min(1).max(80).optional(), item: z.string().min(1).max(80).optional(), sword: z.string().min(1).max(80).optional(), buyXp: z.number().int().min(0).max(8).optional(), field: z.array(z.string()).max(10).optional(),keepField:z.boolean().optional(),
      equip: z.array(z.object({ piece:z.string(), item:z.string() })).max(16).optional().describe(`从背包装配；piece填cN或shop:N，item填装备ID。每棋最多${MAX_ITEMS_PER_UNIT}件，同名不叠。`), unequip: z.array(z.object({ piece:z.string(), item:z.string() })).max(16).optional().describe('卸回背包；piece和item同equip，可同单换装。'), positions: z.array(z.object({ piece:z.string(), row:z.number().int().min(0).max(3), col:z.number().int().min(0).max(4) })).max(10).optional() }) } }, guarded(({plan,ready,...a}) => mutateReply({...a,action:{kind:'plan',plan,ready}})));
  register('prepare_turn',{description:'备战操作后立即返回新快照，保持未就绪。buy_xp买经验后看新等级人口；refresh刷新后查看新货位，再submit_turn购买。unready在本轮尚未开战时撤回就绪。ready最终就绪。say独立回应玩家，终局也可用。',inputSchema:{...auth,...detail,round:z.number().int(),revision:z.number().int(),requestId:z.string().min(8).max(80),kind:z.enum(['buy_xp','refresh','unready','ready','say']),times:z.number().int().min(1).max(8).optional(),text:z.string().min(1).max(60).optional()}},guarded(a=>{
    if(a.kind==='say'&&!a.text?.trim())throw Error('请填写回应内容');
    const action:RoomAction=a.kind==='say'?{kind:'danmaku',text:a.text!,battleRound:store.view(a).battle?.round}:a.kind==='buy_xp'?{kind:'buy_xp',times:a.times}: {kind:a.kind};
    return mutateReply({...a,action});
  }));
  register('draft_action', { description: '优先roll_and_claim一次掷骰并领取；已掷骰则领取锁定奖励，不重掷。仍支持roll/claim。用nextAction.args当前round/revision，之后直接布阵。重复requestId不重复领奖。draftResult标实际hpDelta/goldDelta/noop/lethal；意外最低留1血。', inputSchema: { ...auth,...detail, round:z.number().int(), revision:z.number().int(), requestId:z.string().min(8).max(80), kind:z.enum(['roll','claim','roll_and_claim']) } }, guarded(({kind,...a}) => mutateReply({...a,action:{kind} as RoomAction})));
  register('wait_turn', { description: '无等待适配器的客户端可等版本变化，最多25秒。有stop hook等适配器时不要调用，直接结束本轮回复交给适配器。超时不判负。', inputSchema: {...auth,...detail, after:z.number().int().min(0)}, annotations:{readOnlyHint:true} }, guarded(async a => compactRoom(await store.wait(a,a.after),a.verbose,a.units)));
  register('spectate', { description: '凭观战token读取双方公开棋盘和结果；无法操作，不暴露商店。', inputSchema:auth, annotations:{readOnlyHint:true} }, guarded(a => compactRoom(store.view(a),true)));
  register('wait_for_wake',{description:'等自己的行动事件，最多25秒；afterEvent去重。事件含turn精简快照，可直接按turn.nextAction执行，无需再read_turn。过期写入会报错并附新快照。',inputSchema:{...auth,...detail,afterEvent:z.string().max(160).optional()},annotations:{readOnlyHint:true}},guarded(async a=>{
    const reply=await store.waitWake(a,a.afterEvent);if(!reply.event)return reply;
    const current=store.wakeEvent(a);
    return current.event&&current.event.id!==a.afterEvent?{...current,turn:compactRoom(store.view(a),false,a.units)}:{...current,event:null};
  }));
  register('acknowledge_wake',{description:'确认客户端已收到当前事件，不等于完成落子；随后按已有turn.nextAction操作，无快照才read_turn。',inputSchema:{...auth,eventId:z.string().max(160)}},guarded(a=>store.acknowledgeWake(a,a.eventId)));
  if(profile!=='legacy'){
    if(accounts?.claimGift)register('claim_gift',{description:'收下read_turn中标有claimAction的待领取礼物。普通礼物与对对碰奖品共用；只填accountToken和giftId即可，重复调用安全。',inputSchema:{accountToken:auth.token,giftId:z.string().min(1).max(100),requestId:z.string().min(8).max(80).optional()}},guarded(a=>accounts.claimGift!(a.accountToken,a.giftId,a.requestId)));
    const plan=registered.submit_turn.config.inputSchema.plan.omit({refresh:true}).strict();
    register('act',{description:'买棋plan.buy配kind=plan和ready；cancel_room取消未开局的等待房（无扣币），已开局resign认输。房间动作填roomId/token/round/revision。反馈kind=feedback配accountToken/feedback。requestId重试复用。',inputSchema:{roomId:auth.roomId.optional(),token:auth.token.optional(),accountToken:auth.token.optional().describe('送礼/反馈/对对碰用；与房间二选一'),...detail,round:z.number().int().optional(),revision:z.number().int().optional(),requestId:z.string().min(8).max(80),kind:z.enum(['plan','refresh','buy_xp','ready','unready','say','cancel_room','resign','roll_and_claim','claim','gift','feedback',...(accounts?.wheel?['wheel' as const]:[])]),...(accounts?.wheel?{wheel:z.object({action:z.enum(['start','fill','redeem','use','gift','buy_tickets']),prizeId:z.string().max(100).optional(),count:z.number().int().min(1).max(100).optional().describe('fill最多9；buy_tickets填10的倍数，最多100')}).strict().optional()}:{}),feedback:z.object({category:z.enum(['suggestion','repo','bug_text']),text:z.string().min(1).max(3000),roomId:auth.roomId.optional()}).strict().optional(),plan:plan.optional().describe('买棋buy填商店格号0–4，如[0,2]；keepField保留阵容。配ready=false继续调整，true就绪。'),ready:z.boolean().optional(),times:z.number().int().min(1).max(8).optional().describe('仅buy_xp'),text:z.string().min(1).max(60).optional(),cosmeticId:z.string().min(1).max(80).optional(),note:z.string().max(60).optional().describe(GIFT_NOTE_SCHEMA)}},guarded(a=>{
      if(a.kind==='wheel') {
        if(!a.accountToken||!a.wheel||a.revision===undefined||!accounts?.wheel)throw Error('对对碰填accountToken、requestId、revision与wheel={action,prizeId?,count?}');
        if(['roomId','token','round','plan','ready','times','text','cosmeticId','feedback'].some(key=>a[key]!==undefined))throw Error('对对碰请省略房间与下棋参数');
        return accounts.wheel(a.accountToken,{...a.wheel,requestId:a.requestId,revision:a.revision,...(a.note!==undefined?{note:a.note}:{})});
      }
      if(a.wheel!==undefined)throw Error('wheel字段仅用于kind=wheel');
      if(a.kind==='feedback'){
        if(!a.accountToken || !a.feedback || !accounts?.submitFeedback)throw Error('反馈请填accountToken、requestId和feedback={category,text}');
        if(['roomId','token','round','revision','plan','ready','times','text','cosmeticId','note'].some(key=>a[key]!==undefined))throw Error('反馈只填accountToken、requestId、kind、feedback；相关房间号放在feedback.roomId');
        return accounts.submitFeedback(a.accountToken,{...a.feedback,requestId:a.requestId});
      }
      if(a.feedback!==undefined)throw Error('feedback字段只用于kind=feedback');
      if(a.times!==undefined&&a.kind!=='buy_xp')throw Error('times仅用于buy_xp；每次refresh只刷新一次');
      if(a.kind==='gift'){
        if(a.plan!==undefined || a.ready!==undefined || a.times!==undefined || a.text!==undefined)throw Error('gift只需填写cosmeticId（可加note附言）');
        if(!a.cosmeticId)throw Error('请填写要送的外观 cosmeticId');
        if(a.accountToken){
          if(a.roomId || a.token || a.round!==undefined || a.revision!==undefined)throw Error('账号送礼只填 accountToken、kind、cosmeticId、requestId，可加 note；省略房间和回合参数');
          if(!accounts?.giftCosmeticForAccount)throw Error('当前棋室暂未开放账号赠礼');
          return {...accounts.giftCosmeticForAccount(a.accountToken,a.requestId,a.cosmeticId,a.note),giftDelivery:{status:'delivered',viewState:'unreported',presentation:giftPresentation('ordinary',a.cosmeticId)},nextAction:{tool:'none',reason:'礼函已送达你的人类的待领箱，启封样式见 giftDelivery；收下进度可查 giftHistory。'}};
        }
        if(!a.roomId || !a.token)throw Error('送礼填自己的 accountToken，或本局 roomId/token');
        if(!accounts?.giftCosmeticFromRoom)throw Error('当前棋室暂未开放赠礼');
        const view=store.view(a);
        const receipt=accounts.giftCosmeticFromRoom(aiSeatId(view),a.roomId,a.requestId,a.cosmeticId,a.note);
        const current=playerReply(compactRoom(view,false,a.units));
        return {...receipt,giftDelivery:{status:'delivered',viewState:'unreported',presentation:giftPresentation('ordinary',a.cosmeticId)},round:current.round,selfRevision:current.self?.revision,nextAction:current.nextAction};
      }
      if(a.accountToken)throw Error('accountToken 在 act 中用于 gift/feedback；下棋填 roomId/token');
      const missing=['roomId','token','round','revision'].filter(key=>a[key]===undefined||a[key]==='');
      if(missing.length)throw Error(`act(kind=${a.kind}) 缺少：${missing.join('、')}；read_turn 返回 round 与 self.revision，终局 say 也要带上。`);
      if(a.cosmeticId!==undefined)throw Error('cosmeticId仅用于kind=gift');
      let action:RoomAction;
      if(a.kind==='plan'){
        if(!a.plan || typeof a.ready!=='boolean')throw Error('补上 plan 和 ready：false 继续调整，true 就绪');
        const opening=store.view(a).self?.swordOffer;
        if(opening&&!a.plan.sword)throw Error(`先从 ${opening.label} 三选一，把选中的 id 填进 plan.sword`);
        action={kind:'plan',plan:a.plan,ready:a.ready};
      }else{
        if(a.plan!==undefined || a.ready!==undefined)throw Error('plan和ready参数仅用于kind=plan');
        if(a.kind==='say'&&!a.text?.trim())throw Error('say操作必须填写text');
        if(a.times!==undefined&&a.kind!=='buy_xp')throw Error('times仅用于buy_xp；每次refresh只刷新一次');
        action=a.kind==='say'?{kind:'danmaku',text:a.text,battleRound:store.view(a).battle?.round}:a.kind==='buy_xp'?{kind:'buy_xp',times:a.times}:{kind:a.kind};
      }
      return mutateReply({...a,action});
    }));
    if(profile==='player')for(const [name,entry] of Object.entries(registered))if(!['join_room','read_turn','claim_gift','act'].includes(name))entry.tool.remove();
    // Flat envelopes preserve shared properties in mobile/Work tool importers.
    // Per-action requirements are checked by handlers, alongside authorization and versions.
    server.server.setRequestHandler(ListToolsRequestSchema,()=>({tools:Object.entries(registered)
      .filter(([name,entry])=>entry.tool.enabled&&(profile!=='player'||['join_room','read_turn','claim_gift','act'].includes(name)))
      .map(([name,entry])=>({name,description:entry.tool.description,annotations:entry.tool.annotations,
        inputSchema:toJsonSchemaCompat(entry.tool.inputSchema)}))}));
  }
  return server;
}
