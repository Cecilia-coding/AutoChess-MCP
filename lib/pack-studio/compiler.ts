import type { ItemDef, Role, TraitDef, UnitDef } from '../../content/autochess/types';
import type { DamageType, SkillPrimitive, UnitSkill } from '../../content/autochess/unit-skills';
import { registerEphemeralPack } from '../../packs/ephemeral-registry';
import type { PackDefinition } from '../../packs/types';
import { hashString } from '../autochess/rng';
import type {
  CustomPackV1,
  StudioItemDef,
  StudioSkillDef,
  StudioSkillEffect,
  StudioSkillTarget,
  StudioTraitDef,
  StudioUnitDef,
} from './schema';
import { starAtkMultiplierForPack, starHpMultiplierForPack } from './star-curves';

export type CompiledCustomPack = {
  runtimePackId: string;
  definition: PackDefinition;
  unitIdMap: Record<string, string>;
  traitIdMap: Record<string, string>;
  itemIdMap: Record<string, string>;
  reverseUnitIdMap: Record<string, string>;
};

const STAT_LABELS: Record<string, string> = {
  hp: '生命',
  atk: '攻击',
  armor: '护甲',
  mr: '魔抗',
  range: '射程',
  hpPct: '生命%',
  atkPct: '攻击%',
  armorPct: '护甲%',
  mrPct: '魔抗%',
  aspdPct: '攻速%',
  skillPct: '技伤%',
  basicPct: '普攻%',
  dmgPct: '增伤%',
  drPct: '减伤%',
  skillTakenPct: '技免%',
  penetrationPct: '穿透%',
  penetrationFlat: '破防',
  dodgePct: '闪避%',
  critPct: '暴击%',
  critDamagePct: '爆伤%',
  lifestealPct: '吸血%',
  manaRegenPct: '回蓝%',
  manaStartFlat: '初始蓝',
  healReceivePct: '受疗%',
  regenPctPerSec: '秒回%',
  moveSpeedPct: '移速%',
  startShieldPct: '开战盾%',
  distanceDamagePctPerTile: '距伤%',
};

export function formatStatOpsSummary(ops: readonly { stat: string; value: number }[]): string {
  if (!ops.length) return '无面板词条';
  return ops
    .map((op) => {
      const label = STAT_LABELS[op.stat] ?? op.stat;
      const sign = op.value >= 0 ? '+' : '';
      const isPct = label.endsWith('%');
      const baseName = isPct ? label.slice(0, -1) : label;
      return `${baseName} ${sign}${op.value}${isPct ? '%' : ''}`;
    })
    .join(' · ');
}

export function computeCustomPackId(pack: CustomPackV1): string {
  const payload = JSON.stringify(pack);
  const h1 = hashString(0x811c9dc5, payload).toString(16).padStart(8, '0');
  const h2 = hashString(0x9e3779b9, payload).toString(16).padStart(8, '0');
  return `custom:${pack.id.slice(0, 12)}-${h1}${h2}`;
}

function fallbackRoleSkillId(role: Role): string {
  if (role === 'tank') return 'self-shield';
  if (role === 'support') return 'ally-heal';
  if (role === 'caster') return 'bolt';
  return 'strike';
}

function resolveEnemyTarget(
  target: StudioSkillTarget,
  hasAttackTarget: boolean,
): 'current' | 'nearestFoes' | 'farthestFoes' | 'allFoes' {
  if (target === 'all_enemies') return 'allFoes';
  if (target === 'farthest_enemy') return 'farthestFoes';
  if (target === 'current_enemy' && hasAttackTarget) return 'current';
  return 'nearestFoes';
}

function compileEffect(
  effect: StudioSkillEffect,
  target: StudioSkillTarget,
  targetCount: number,
  hasAttackTarget: boolean,
): SkillPrimitive {
  switch (effect.kind) {
    case 'damage': {
      const dmgType: DamageType = effect.damageType;
      return {
        op: 'damage',
        at: resolveEnemyTarget(target, hasAttackTarget),
        count: targetCount,
        type: dmgType,
        scale: {
          flatByStar: effect.baseByStar,
          ...(effect.atkPct ? { atkPct: effect.atkPct } : {}),
          ...(effect.hpPct ? { hpPct: effect.hpPct } : {}),
        },
      };
    }
    case 'shield': {
      const at = target === 'self' ? 'self' : 'allies';
      return {
        op: 'shield',
        at,
        ...(target === 'lowest_hp_ally' ? { count: targetCount } : {}),
        ms: effect.durationMs,
        scale: {
          flatByStar: effect.baseByStar,
          ...(effect.hpPct ? { hpPct: effect.hpPct } : {}),
        },
      };
    }
    case 'heal': {
      const at =
        target === 'self'
          ? 'self'
          : target === 'all_allies'
            ? 'allAllies'
            : 'weakestAlly';
      return {
        op: 'heal',
        at,
        scale: {
          flatByStar: effect.baseByStar,
          ...(effect.hpPct ? { hpPct: effect.hpPct } : {}),
        },
      };
    }
    case 'stun': {
      const enemyAt = resolveEnemyTarget(target, hasAttackTarget);
      const statusAt =
        enemyAt === 'allFoes'
          ? 'nearestFoes'
          : enemyAt === 'farthestFoes'
            ? 'randomFoes'
            : enemyAt;
      return {
        op: 'status',
        at: statusAt,
        count: enemyAt === 'allFoes' ? 8 : targetCount,
        status: 'stun',
        msByStar: effect.durationMsByStar,
      };
    }
    case 'stat_buff': {
      const at =
        target === 'self'
          ? 'self'
          : target === 'all_allies'
            ? 'allies'
            : 'strongestAllies';
      return {
        op: 'buff',
        at,
        count: target === 'all_allies' ? 10 : targetCount,
        stat: effect.stat,
        value: effect.value,
        ms: effect.durationMs,
      };
    }
    case 'stat_debuff': {
      return {
        op: 'debuff',
        at: resolveEnemyTarget(target, hasAttackTarget) === 'farthestFoes'
          ? 'nearestFoes'
          : resolveEnemyTarget(target, hasAttackTarget) === 'allFoes'
            ? 'allFoes'
            : hasAttackTarget && target === 'current_enemy'
              ? 'target'
              : 'nearestFoes',
        count: targetCount,
        stat: effect.stat,
        value: effect.value,
        ms: effect.durationMs,
      };
    }
  }
}

export function compileStudioSkill(skill: StudioSkillDef): UnitSkill {
  const hasAttackTarget =
    skill.trigger.kind === 'mana' || skill.trigger.kind === 'every_attacks';
  const primitives = skill.effects.map((eff) =>
    compileEffect(eff, skill.target, skill.targetCount, hasAttackTarget),
  );

  if (skill.trigger.kind === 'mana') {
    return {
      name: skill.name,
      mana: skill.trigger.maxMana,
      ...(skill.trigger.startMana
        ? { passiveStats: [{ stat: 'manaStartFlat', value: skill.trigger.startMana }] }
        : {}),
      cast: primitives,
    };
  }
  if (skill.trigger.kind === 'every_attacks') {
    return {
      name: skill.name,
      mana: 0,
      passive: true,
      onAttack: [{ op: 'everyNthAttack', every: skill.trigger.count, effects: primitives }],
    };
  }
  if (skill.trigger.kind === 'battle_start') {
    return {
      name: skill.name,
      mana: 0,
      passive: true,
      onBattleStart: primitives,
    };
  }
  return {
    name: skill.name,
    mana: 0,
    passive: true,
    tick: { everyMs: skill.trigger.everyMs, effects: primitives },
  };
}

function compileTrait(trait: StudioTraitDef, mappedId: string): TraitDef {
  const sortedTiers = [...trait.tiers].sort((a, b) => a.count - b.count);
  const ladders = sortedTiers
    .map(
      (tier) =>
        `${tier.count}${tier.scope === 'team' ? '（全队）' : ''}：${formatStatOpsSummary(tier.stats)}`,
    )
    .join(' / ');
  const tierEffects: TraitDef['tierEffects'] = {};
  for (const tier of sortedTiers) {
    tierEffects[tier.count] =
      tier.scope === 'team' ? { teamStats: tier.stats } : { stats: tier.stats };
  }
  return {
    id: mappedId,
    name: trait.name,
    kind: trait.kind,
    tiers: sortedTiers.map((tier) => tier.count),
    ladders: trait.description ? `${trait.description}｜${ladders}` : ladders,
    tierEffects,
  };
}

function compileUnit(
  unit: StudioUnitDef,
  mappedId: string,
  pack: CustomPackV1,
  traitIdMap: Record<string, string>,
): UnitDef {
  const skillNotePrefix =
    unit.skill.trigger.kind === 'mana'
      ? `主动「${unit.skill.name}」(${unit.skill.trigger.maxMana}蓝)`
      : `被动「${unit.skill.name}」`;
  const manaCost = unit.skill.trigger.kind === 'mana' ? unit.skill.trigger.maxMana : 80;
  return {
    id: mappedId,
    spriteId: unit.spriteId,
    name: unit.name,
    cost: unit.cost,
    autochessCost: unit.cost,
    role: unit.role,
    skillId: fallbackRoleSkillId(unit.role),
    autochessSkillId: fallbackRoleSkillId(unit.role),
    factions: unit.factions.map((id) => traitIdMap[id] ?? id),
    jobs: unit.jobs.map((id) => traitIdMap[id] ?? id),
    summon: false,
    master: false,
    companion: false,
    source: 'pack',
    skillNote: `${skillNotePrefix}：${unit.skill.description || '自定义技能'}`,
    artNeed: unit.spriteId,
    statTemplate: { ...unit.stats },
    manaByStar: [manaCost, manaCost, manaCost],
    starMult: {
      hp: [
        1,
        starHpMultiplierForPack(pack.starGrowth, unit.cost, 2),
        starHpMultiplierForPack(pack.starGrowth, unit.cost, 3),
      ],
      atk: [
        1,
        starAtkMultiplierForPack(pack.starGrowth, unit.cost, 2),
        starAtkMultiplierForPack(pack.starGrowth, unit.cost, 3),
      ],
    },
    disableLowCostStarBonus: !pack.starGrowth.lowCostDefBonus,
  };
}

function compileItem(
  item: StudioItemDef,
  mappedId: string,
  traitIdMap: Record<string, string>,
): ItemDef {
  return {
    id: mappedId,
    name: item.name,
    color: item.tier,
    family: item.tier,
    atk: 0,
    hp: 0,
    armor: 0,
    mr: 0,
    aspdPct: 0,
    skillPct: 0,
    stats: item.stats,
    ...(item.grantTraitId
      ? { grantTraits: [traitIdMap[item.grantTraitId] ?? item.grantTraitId] }
      : {}),
    ...(item.note ? { note: item.note } : {}),
  };
}

export function compileCustomPack(pack: CustomPackV1): CompiledCustomPack {
  const runtimePackId = computeCustomPackId(pack);
  const traitIdMap: Record<string, string> = {};
  const unitIdMap: Record<string, string> = {};
  const itemIdMap: Record<string, string> = {};
  const reverseUnitIdMap: Record<string, string> = {};

  for (const t of pack.traits) traitIdMap[t.id] = `${runtimePackId}/tr:${t.id}`;
  for (const u of pack.units) {
    const mapped = `${runtimePackId}/un:${u.id}`;
    unitIdMap[u.id] = mapped;
    reverseUnitIdMap[mapped] = u.id;
  }
  for (const it of pack.items) itemIdMap[it.id] = `${runtimePackId}/it:${it.id}`;

  const traits = pack.traits.map((t) => compileTrait(t, traitIdMap[t.id]!));
  const roster = pack.units.map((u) => compileUnit(u, unitIdMap[u.id]!, pack, traitIdMap));
  const items = pack.items.map((it) => compileItem(it, itemIdMap[it.id]!, traitIdMap));
  const skills: Record<string, UnitSkill> = Object.fromEntries(
    pack.units.map((u) => [unitIdMap[u.id]!, compileStudioSkill(u.skill)]),
  );

  const openingIds = pack.items
    .filter((item) => item.isOpeningChoice)
    .map((item) => itemIdMap[item.id]!);
  const kitItems = pack.items
    .filter((item) => item.tier === 'white' || item.tier === 'purple')
    .slice(0, 2)
    .map((item) => itemIdMap[item.id]!);

  const buffFlavor = pack.buffFlavor === 'tech' ? 'ai' : 'jianghu';
  const definition: PackDefinition = {
    id: runtimePackId,
    displayName: pack.title,
    icon: '📐',
    description: pack.subtitle || '玩家与机共创自定义棋谱',
    buffFlavor,
    presentation: {
      renderer: 'pixel-2d',
      appearanceId: 'studio-pixels',
      soundId: buffFlavor === 'ai' ? 'ai-sound' : 'jianghu-sound',
    },
    roster,
    traits,
    items,
    skills,
    terms: pack.terms,
    ...(openingIds.length
      ? {
        opening: {
          label: `${pack.title} · 初始装备`,
          tiers: [openingIds, openingIds, openingIds],
        },
      }
      : {}),
    ...(kitItems.length ? { kitItems } : {}),
    hexes: [],
    draftIntro: `「${pack.title}」自定义对局：沿用共享旅途奇遇与分阶补给箱。`,
  };

  return { runtimePackId, definition, unitIdMap, traitIdMap, itemIdMap, reverseUnitIdMap };
}

export function ensureCustomPackRegistered(pack: CustomPackV1): CompiledCustomPack {
  const compiled = compileCustomPack(pack);
  registerEphemeralPack(compiled.definition);
  return compiled;
}
