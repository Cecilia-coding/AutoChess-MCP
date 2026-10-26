import { defineUnit } from '../../content/autochess/define-unit';
import type { UnitDef } from '../../content/autochess/types';

const fallbackSkillNote = {
  strike: '积满内力后，对最近的敌人造成攻击力 180% 的物理伤害。',
  'ally-heal': '积满内力后，治疗本方气血比例最低的棋子，基础治疗量为其最大气血的 14%。',
  'self-shield': '积满内力后，为自己获得最大气血 18% 的护盾，持续 4 秒。',
  bolt: '积满内力后，对最近的敌人造成攻击力 180% 的法术伤害。',
} as const;

/**
 * 夜航船：40 人。低费铺厚、高费稀少且 1★ 不强。
 * 12 / 10 / 8 / 7 / 3。技能仍复用现有战斗积木。
 */
export const jianghuRoster: UnitDef[] = [
  defineUnit('jh-boatgirl', '阿桃', 1, 'support', 'ally-heal', ['canal'], ['sustain'], '船头灯影', {
    autochessOnly: true,
    statTemplate: { hp: 760, atk: 30, armor: 70, mr: 70, aspd: 0.7, range: 3 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-hauler', '纤夫老黑', 1, 'melee', 'strike', ['canal'], ['brawler'], '纤绳一荡', {
    autochessOnly: true,
    statTemplate: { hp: 760, atk: 34, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-sailor', '水手', 1, 'melee', 'strike', ['canal'], ['warrior'], '赤脚在跳板上跑', {
    autochessOnly: true,
    statTemplate: { hp: 780, atk: 35, armor: 85, mr: 70, aspd: 0.78, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-lamp', '灯油妹', 1, 'ranged', 'strike', ['canal'], ['marksman'], '桅灯照路', {
    autochessOnly: true,
    statTemplate: { hp: 700, atk: 35, armor: 70, mr: 70, aspd: 0.8, range: 3 },
    manaByStar: [999, 999, 999], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-outrider', '趟子手', 1, 'melee', 'strike', ['escort'], ['warrior'], '镖旗小跑', {
    autochessOnly: true,
    statTemplate: { hp: 760, atk: 36, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [55, 55, 55], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-cook', '厨子', 1, 'support', 'ally-heal', ['escort'], ['sustain'], '干粮和烫伤药', {
    autochessOnly: true,
    statTemplate: { hp: 760, atk: 30, armor: 70, mr: 70, aspd: 0.7, range: 3 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-shiv', '短刀阿七', 1, 'melee', 'strike', ['blade'], ['assassin'], '袖里短刀', {
    autochessOnly: true,
    statTemplate: { hp: 730, atk: 36, armor: 70, mr: 70, aspd: 0.82, range: 1 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-beggar', '叫花', 1, 'melee', 'strike', ['blade'], ['assassin'], '碗一扔人就没了', {
    autochessOnly: true,
    statTemplate: { hp: 720, atk: 35, armor: 70, mr: 70, aspd: 0.82, range: 1 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-fan', '票友小满', 1, 'ranged', 'strike', ['troupe'], ['marksman'], '廊上拍曲', {
    autochessOnly: true,
    statTemplate: { hp: 700, atk: 35, armor: 70, mr: 70, aspd: 0.8, range: 3 },
    manaByStar: [999, 999, 999], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-drum', '司鼓', 1, 'melee', 'strike', ['troupe'], ['brawler'], '开场一槌', {
    autochessOnly: true,
    statTemplate: { hp: 760, atk: 34, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-runner', '捕快周平', 1, 'melee', 'strike', ['yamen'], ['warrior'], '满街追人', {
    autochessOnly: true,
    statTemplate: { hp: 760, atk: 35, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [55, 55, 55], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-copyist', '书办', 1, 'support', 'ally-heal', ['yamen'], ['advisor'], '墨未干，人已到', {
    autochessOnly: true,
    statTemplate: { hp: 740, atk: 30, armor: 70, mr: 70, aspd: 0.7, range: 3 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-clerk', '账房', 2, 'support', 'ally-heal', ['canal'], ['advisor'], '算盘一响', {
    autochessOnly: true,
    statTemplate: { hp: 820, atk: 32, armor: 70, mr: 70, aspd: 0.7, range: 3 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-medic', '船医', 2, 'support', 'ally-heal', ['canal'], ['sustain'], '晕船药比刀快', {
    autochessOnly: true,
    statTemplate: { hp: 860, atk: 34, armor: 70, mr: 70, aspd: 0.72, range: 3 },
    manaByStar: [25, 25, 25], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-escort', '镖师沈横', 2, 'tank', 'self-shield', ['escort'], ['fortress'], '站桩不走', {
    autochessOnly: true,
    statTemplate: { hp: 1080, atk: 34, armor: 105, mr: 105, aspd: 0.65, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote['self-shield'],
  }),
  defineUnit('jh-outrunner', '押镖', 2, 'ranged', 'strike', ['escort'], ['marksman'], '先放冷箭再护箱', {
    autochessOnly: true,
    statTemplate: { hp: 820, atk: 40, armor: 70, mr: 70, aspd: 0.8, range: 3 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-nightblade', '夜行人', 2, 'melee', 'strike', ['blade'], ['assassin'], '屋脊上过', {
    autochessOnly: true,
    statTemplate: { hp: 900, atk: 42, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-flyer', '飞贼', 2, 'ranged', 'strike', ['blade'], ['marksman'], '瓦上取物', {
    autochessOnly: true,
    statTemplate: { hp: 800, atk: 42, armor: 70, mr: 70, aspd: 0.84, range: 3 },
    manaByStar: [999, 999, 999], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-huadan', '花旦彩衣', 2, 'support', 'ally-heal', ['troupe'], ['sustain'], '水袖一抛', {
    autochessOnly: true,
    statTemplate: { hp: 900, atk: 38, armor: 70, mr: 70, aspd: 0.75, range: 3 },
    manaByStar: [25, 25, 25], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-wusheng', '武生', 2, 'melee', 'strike', ['troupe'], ['warrior'], '起霸亮相', {
    autochessOnly: true,
    statTemplate: { hp: 920, atk: 42, armor: 85, mr: 70, aspd: 0.82, range: 1 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-secretary', '师爷吴签', 2, 'caster', 'bolt', ['yamen'], ['advisor'], '刀笔比刀快', {
    autochessOnly: true,
    statTemplate: { hp: 860, atk: 40, armor: 70, mr: 70, aspd: 0.78, range: 3 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.bolt,
  }),
  defineUnit('jh-constable', '捕头', 2, 'tank', 'self-shield', ['yamen'], ['fortress'], '班房门口那个人', {
    autochessOnly: true,
    statTemplate: { hp: 1040, atk: 34, armor: 105, mr: 105, aspd: 0.65, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote['self-shield'],
  }),
  defineUnit('jh-helmsman', '舵爷', 3, 'tank', 'self-shield', ['canal'], ['fortress'], '夜航看水', {
    autochessOnly: true,
    statTemplate: { hp: 1060, atk: 40, armor: 105, mr: 105, aspd: 0.7, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote['self-shield'],
  }),
  defineUnit('jh-storeman', '仓管', 3, 'caster', 'bolt', ['canal'], ['advisor'], '粮册比刀硬', {
    autochessOnly: true,
    statTemplate: { hp: 980, atk: 44, armor: 70, mr: 70, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.bolt,
  }),
  defineUnit('jh-chief', '总镖头', 3, 'melee', 'strike', ['escort'], ['warrior'], '专冲对面旗手', {
    autochessOnly: true,
    statTemplate: { hp: 1180, atk: 48, armor: 85, mr: 85, aspd: 0.85, range: 1 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-carter', '车夫', 3, 'melee', 'strike', ['escort'], ['brawler'], '车辕一横挡路', {
    autochessOnly: true,
    statTemplate: { hp: 1100, atk: 44, armor: 105, mr: 85, aspd: 0.75, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-bladehead', '梅十三', 3, 'melee', 'strike', ['blade'], ['assassin'], '刀客里偏最快', {
    autochessOnly: true,
    statTemplate: { hp: 1100, atk: 46, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [50, 50, 50], critPct: 14, skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-qingyi', '青衣', 3, 'melee', 'strike', ['troupe'], ['assassin'], '水袖里藏刀', {
    autochessOnly: true,
    statTemplate: { hp: 1050, atk: 46, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-laosheng', '老生', 3, 'ranged', 'strike', ['troupe'], ['advisor'], '定场诗', {
    autochessOnly: true,
    statTemplate: { hp: 1093, atk: 46, armor: 70, mr: 70, aspd: 0.75, range: 3 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-inspector', '巡检', 3, 'ranged', 'strike', ['yamen'], ['marksman'], '夜巡掷签', {
    autochessOnly: true,
    statTemplate: { hp: 1033, atk: 46, armor: 70, mr: 70, aspd: 0.8, range: 3 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-canal-lord', '漕帮主', 4, 'melee', 'strike', ['canal'], ['warrior'], '粮船过闸', {
    autochessOnly: true,
    statTemplate: { hp: 1180, atk: 48, armor: 85, mr: 85, aspd: 0.75, range: 1 },
    manaByStar: [60, 60, 60], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-escort-lady', '女镖头', 4, 'tank', 'self-shield', ['escort'], ['fortress'], '红缨枪横在镖门', {
    autochessOnly: true,
    statTemplate: { hp: 1280, atk: 44, armor: 105, mr: 105, aspd: 0.68, range: 1 },
    manaByStar: [65, 65, 65], skillNote: fallbackSkillNote['self-shield'],
  }),
  defineUnit('jh-garrison', '总镇', 4, 'melee', 'strike', ['escort'], ['warrior'], '城门炮响', {
    autochessOnly: true,
    statTemplate: { hp: 1200, atk: 50, armor: 85, mr: 85, aspd: 0.78, range: 1 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-troupe-lead', '班主', 4, 'support', 'ally-heal', ['troupe'], ['sustain'], '戏散了还在收箱', {
    autochessOnly: true,
    statTemplate: { hp: 1120, atk: 46, armor: 70, mr: 70, aspd: 0.78, range: 3 },
    manaByStar: [25, 25, 25], skillNote: fallbackSkillNote['ally-heal'],
  }),
  defineUnit('jh-swordsman', '剑客', 4, 'melee', 'strike', ['blade'], ['assassin'], '只问一剑', {
    autochessOnly: true,
    statTemplate: { hp: 1150, atk: 50, armor: 70, mr: 70, aspd: 0.8, range: 1 },
    manaByStar: [50, 50, 50], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-shadow', '影', 4, 'melee', 'strike', ['blade'], ['assassin'], '灯灭人不见', {
    autochessOnly: true,
    statTemplate: { hp: 1120, atk: 52, armor: 70, mr: 70, aspd: 0.84, range: 1 },
    manaByStar: [50, 50, 50], critPct: 16, skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-magistrate', '知县', 4, 'ranged', 'bolt', ['yamen'], ['advisor'], '惊堂木一拍', {
    autochessOnly: true,
    statTemplate: { hp: 1100, atk: 48, armor: 70, mr: 70, aspd: 0.75, range: 3 },
    manaByStar: [90, 90, 90], skillNote: fallbackSkillNote.bolt,
  }),
  defineUnit('jh-hebo', '河伯会首', 5, 'tank', 'self-shield', ['canal'], ['fortress'], '人口中的河神', {
    autochessOnly: true,
    statTemplate: { hp: 1320, atk: 46, armor: 105, mr: 105, aspd: 0.68, range: 1 },
    manaByStar: [70, 70, 70], skillNote: fallbackSkillNote['self-shield'],
  }),
  defineUnit('jh-starlet', '当红名角', 5, 'ranged', 'strike', ['troupe'], ['marksman'], '压轴一出', {
    autochessOnly: true,
    statTemplate: { hp: 1180, atk: 54, armor: 70, mr: 70, aspd: 0.85, range: 3 },
    manaByStar: [20, 20, 20], skillNote: fallbackSkillNote.strike,
  }),
  defineUnit('jh-governor', '巡抚', 5, 'caster', 'bolt', ['yamen'], ['advisor'], '文书盖下去', {
    autochessOnly: true,
    statTemplate: { hp: 1200, atk: 52, armor: 70, mr: 70, aspd: 0.75, range: 3 },
    manaByStar: [50, 50, 30], skillNote: fallbackSkillNote.bolt,
  }),
];

export const JIANGHU_ROSTER_IDS = new Set(jianghuRoster.map((unit) => unit.id));
