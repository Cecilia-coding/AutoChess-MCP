import type { Role } from '../../content/autochess/types';

export type StudioSpriteStyle = 'studio' | 'ai' | 'jianghu';

export type StudioSpriteMeta = {
  id: string;
  label: string;
  style: StudioSpriteStyle;
  suggestedRole: Role;
  color: string;
  portraitUrl: string;
};

const STUDIO_VER = '20261118r1';
const AI_VER = '20261111r3';
const JH_VER = '20261114r1';

const STUDIO_ORIGINAL_RAW: readonly { id: string; label: string; suggestedRole: Role; color: string }[] = [
  { id: 'st-slime-knight', label: '史莱姆骑', suggestedRole: 'tank', color: '#62c49e' },
  { id: 'st-clock-bunny', label: '发条兔', suggestedRole: 'melee', color: '#f2a2b4' },
  { id: 'st-shroom-guard', label: '蘑菇卫', suggestedRole: 'tank', color: '#d97762' },
  { id: 'st-lantern-spirit', label: '提灯灵', suggestedRole: 'support', color: '#9ad6ec' },
  { id: 'st-cat-mage', label: '黑猫巫', suggestedRole: 'caster', color: '#8c72cf' },
  { id: 'st-crane-archer', label: '纸鹤弓', suggestedRole: 'ranged', color: '#7ab7eb' },
  { id: 'st-music-doll', label: '八音姬', suggestedRole: 'support', color: '#f0c46c' },
  { id: 'st-crt-bot', label: '小电视', suggestedRole: 'caster', color: '#69c9b4' },
  { id: 'st-tape-ranger', label: '磁带侠', suggestedRole: 'ranged', color: '#e8906e' },
  { id: 'st-floppy-squire', label: '软盘盾', suggestedRole: 'tank', color: '#5f8fd9' },
  { id: 'st-bulb-wisp', label: '灯泡精', suggestedRole: 'caster', color: '#f5d76e' },
  { id: 'st-gear-golem', label: '齿轮偶', suggestedRole: 'tank', color: '#b88a68' },
  { id: 'st-dice-imp', label: '骰子怪', suggestedRole: 'melee', color: '#e66e85' },
  { id: 'st-tower-keeper', label: '灯塔偶', suggestedRole: 'support', color: '#e8c07a' },
  { id: 'st-paper-boat', label: '折纸舟', suggestedRole: 'ranged', color: '#7cc7c4' },
  { id: 'st-hourglass-sage', label: '沙漏翁', suggestedRole: 'caster', color: '#b487d9' },
  { id: 'st-moon-sprite', label: '弦月灵', suggestedRole: 'caster', color: '#f2cf68' },
  { id: 'st-cactus-boxer', label: '盆栽刺', suggestedRole: 'melee', color: '#6bb87b' },
  { id: 'st-tea-mimic', label: '茶壶匠', suggestedRole: 'support', color: '#c8b4db' },
  { id: 'st-star-knight', label: '星象棋', suggestedRole: 'melee', color: '#5c6ea8' },
];

const AI_SPRITES_RAW: readonly { id: string; label: string; suggestedRole: Role; color: string }[] = [
  { id: 'ai-claude', label: 'Claude', suggestedRole: 'melee', color: '#ef9362' },
  { id: 'ai-gpt', label: 'GPT', suggestedRole: 'support', color: '#dfe5e2' },
  { id: 'ai-codex', label: 'Codex', suggestedRole: 'ranged', color: '#f4f4ef' },
  { id: 'ai-deepseek', label: 'DeepSeek', suggestedRole: 'caster', color: '#6c95f7' },
  { id: 'ai-gemini', label: 'Gemini', suggestedRole: 'caster', color: '#a688f7' },
  { id: 'ai-grok', label: 'Grok', suggestedRole: 'melee', color: '#7f8798' },
  { id: 'ai-kimi', label: 'Kimi', suggestedRole: 'ranged', color: '#6594f7' },
  { id: 'ai-qwen', label: 'Qwen', suggestedRole: 'caster', color: '#ad7ef0' },
  { id: 'ai-glm', label: 'GLM', suggestedRole: 'caster', color: '#5f96f7' },
  { id: 'ai-minimax', label: 'MiniMax', suggestedRole: 'caster', color: '#f79672' },
  { id: 'ai-characterai', label: 'Character.AI', suggestedRole: 'support', color: '#dcd8e2' },
  { id: 'ai-replika', label: 'Replika', suggestedRole: 'support', color: '#e2b3f2' },
  { id: 'ai-talkie', label: 'Talkie', suggestedRole: 'ranged', color: '#f7cb68' },
  { id: 'ai-xiaoice', label: 'Xiaoice', suggestedRole: 'support', color: '#95e5ec' },
  { id: 'ai-doubao', label: '豆包', suggestedRole: 'caster', color: '#ef6868' },
  { id: 'ai-llama', label: 'Llama', suggestedRole: 'tank', color: '#b299f5' },
  { id: 'ai-mistral', label: 'Mistral', suggestedRole: 'ranged', color: '#f5a256' },
  { id: 'ai-copilot', label: 'Copilot', suggestedRole: 'support', color: '#72cee8' },
  { id: 'ai-ernie', label: 'ERNIE', suggestedRole: 'caster', color: '#9385f2' },
  { id: 'ai-hunyuan', label: 'Hunyuan', suggestedRole: 'caster', color: '#7ae0b2' },
  { id: 'ai-musespark', label: 'Muse', suggestedRole: 'support', color: '#e2ccaa' },
  { id: 'ai-nai', label: 'Nai', suggestedRole: 'caster', color: '#b17de8' },
  { id: 'ai-tripo', label: 'Tripo', suggestedRole: 'tank', color: '#72dec6' },
  { id: 'ai-manus', label: 'Manus', suggestedRole: 'melee', color: '#faf2e4' },
  { id: 'ai-kiro', label: 'Kiro', suggestedRole: 'melee', color: '#c394f0' },
  { id: 'ai-jimeng', label: '即梦', suggestedRole: 'caster', color: '#ef7ec8' },
  { id: 'ai-gemma', label: 'Gemma', suggestedRole: 'caster', color: '#80d2ea' },
  { id: 'ai-kling', label: 'Kling', suggestedRole: 'ranged', color: '#b4eb5e' },
  { id: 'ai-ollama', label: 'Ollama', suggestedRole: 'tank', color: '#f5e8d5' },
];

const JIANGHU_SPRITES_RAW: readonly { id: string; label: string; suggestedRole: Role; color: string }[] = [
  { id: 'jh-boatgirl', label: '阿桃', suggestedRole: 'ranged', color: '#5d8a82' },
  { id: 'jh-hauler', label: '纤夫老黑', suggestedRole: 'tank', color: '#5d8a82' },
  { id: 'jh-sailor', label: '水手', suggestedRole: 'melee', color: '#5d8a82' },
  { id: 'jh-lamp', label: '灯油妹', suggestedRole: 'caster', color: '#5d8a82' },
  { id: 'jh-clerk', label: '账房', suggestedRole: 'support', color: '#5d8a82' },
  { id: 'jh-medic', label: '船医', suggestedRole: 'support', color: '#5d8a82' },
  { id: 'jh-helmsman', label: '舵爷', suggestedRole: 'tank', color: '#5d8a82' },
  { id: 'jh-storeman', label: '仓管', suggestedRole: 'tank', color: '#5d8a82' },
  { id: 'jh-canal-lord', label: '漕帮主', suggestedRole: 'melee', color: '#5d8a82' },
  { id: 'jh-hebo', label: '河伯会首', suggestedRole: 'caster', color: '#5d8a82' },
  { id: 'jh-outrider', label: '趟子手', suggestedRole: 'melee', color: '#a85258' },
  { id: 'jh-cook', label: '厨子', suggestedRole: 'support', color: '#a85258' },
  { id: 'jh-escort', label: '镖师沈横', suggestedRole: 'tank', color: '#a85258' },
  { id: 'jh-outrunner', label: '押镖', suggestedRole: 'ranged', color: '#a85258' },
  { id: 'jh-chief', label: '总镖头', suggestedRole: 'melee', color: '#a85258' },
  { id: 'jh-carter', label: '车夫', suggestedRole: 'tank', color: '#a85258' },
  { id: 'jh-escort-lady', label: '女镖头', suggestedRole: 'melee', color: '#a85258' },
  { id: 'jh-garrison', label: '总镇', suggestedRole: 'tank', color: '#a85258' },
  { id: 'jh-shiv', label: '短刀阿七', suggestedRole: 'melee', color: '#5a627d' },
  { id: 'jh-beggar', label: '叫花', suggestedRole: 'support', color: '#5a627d' },
  { id: 'jh-nightblade', label: '夜行人', suggestedRole: 'melee', color: '#5a627d' },
  { id: 'jh-flyer', label: '飞贼', suggestedRole: 'ranged', color: '#5a627d' },
  { id: 'jh-bladehead', label: '梅十三', suggestedRole: 'melee', color: '#5a627d' },
  { id: 'jh-swordsman', label: '剑客', suggestedRole: 'melee', color: '#5a627d' },
  { id: 'jh-shadow', label: '影', suggestedRole: 'ranged', color: '#5a627d' },
  { id: 'jh-fan', label: '票友小满', suggestedRole: 'support', color: '#9e5575' },
  { id: 'jh-drum', label: '司鼓', suggestedRole: 'support', color: '#9e5575' },
  { id: 'jh-huadan', label: '花旦彩衣', suggestedRole: 'caster', color: '#9e5575' },
  { id: 'jh-wusheng', label: '武生', suggestedRole: 'melee', color: '#9e5575' },
  { id: 'jh-qingyi', label: '青衣', suggestedRole: 'caster', color: '#9e5575' },
  { id: 'jh-laosheng', label: '老生', suggestedRole: 'support', color: '#9e5575' },
  { id: 'jh-troupe-lead', label: '班主', suggestedRole: 'support', color: '#9e5575' },
  { id: 'jh-starlet', label: '当红名角', suggestedRole: 'caster', color: '#9e5575' },
  { id: 'jh-runner', label: '捕快周平', suggestedRole: 'melee', color: '#4b5b7e' },
  { id: 'jh-copyist', label: '书办', suggestedRole: 'ranged', color: '#4b5b7e' },
  { id: 'jh-secretary', label: '师爷吴签', suggestedRole: 'caster', color: '#4b5b7e' },
  { id: 'jh-constable', label: '捕头', suggestedRole: 'tank', color: '#4b5b7e' },
  { id: 'jh-inspector', label: '巡检', suggestedRole: 'ranged', color: '#4b5b7e' },
  { id: 'jh-magistrate', label: '知县', suggestedRole: 'caster', color: '#4b5b7e' },
  { id: 'jh-governor', label: '巡抚', suggestedRole: 'caster', color: '#4b5b7e' },
];

export const STUDIO_ORIGINAL_SPRITES: readonly StudioSpriteMeta[] = STUDIO_ORIGINAL_RAW.map((entry) => ({
  ...entry,
  style: 'studio' as const,
  portraitUrl: `/pixel-studio/portraits/${entry.id}.png?v=${STUDIO_VER}`,
}));

export const STUDIO_SPRITES: readonly StudioSpriteMeta[] = [
  ...STUDIO_ORIGINAL_SPRITES,
  ...AI_SPRITES_RAW.map((entry) => ({
    ...entry,
    style: 'ai' as const,
    portraitUrl: `/pixel-mascots/portraits/${entry.id}.png?v=${AI_VER}`,
  })),
  ...JIANGHU_SPRITES_RAW.map((entry) => ({
    ...entry,
    style: 'jianghu' as const,
    portraitUrl: `/pixel-jianghu/portraits/${entry.id}.png?v=${JH_VER}`,
  })),
];

const SPRITE_BY_ID = new Map(STUDIO_SPRITES.map((entry) => [entry.id, entry]));

export function isValidStudioSpriteId(id: string): boolean {
  return SPRITE_BY_ID.has(id);
}

export function studioSpriteById(id: string): StudioSpriteMeta | undefined {
  return SPRITE_BY_ID.get(id);
}
