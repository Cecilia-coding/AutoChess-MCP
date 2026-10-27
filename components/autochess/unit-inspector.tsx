import type { ReactNode } from 'react';
import Image from 'next/image';
import { items, itemHint } from '@/content/autochess/items';
import { activeTier, findTrait } from '@/content/autochess/traits';
import { hazardLabels } from '@/lib/autochess/hazard-display';
import { inspectUnit } from '@/lib/autochess/unit-inspection';
import { itemImage } from '@/lib/meta/cosmetics';
import type { Combatant, TeamId } from '@/lib/autochess/types';
import { starLabel, type PackTerms } from '@/packs/terms';
import './unit-inspector.css';

const ROLES = { tank: '坦克', melee: '近战', ranged: '远程', caster: '法师', support: '辅助' };
export default function UnitInspector({ piece, board, side, owner, replaying, onClose, actions, terms }: {
  piece: Combatant; board: Combatant[]; side: TeamId; owner: string; replaying: boolean;
  onClose: () => void; actions: ReactNode; terms: PackTerms;
}) {
  const { unit, cost, fielded, stats, skill, traits, counts, notes } = inspectUnit(piece, board, side);
  const cells = [['生命', stats.maxHp], ['攻击', stats.atk], ['护甲', stats.armor],
    ['魔抗', stats.mr], ['攻速', `${stats.aspd.toFixed(2)}/秒`], ['射程', `${stats.range} 格`]];
  const itemText = (id: string) => itemHint(id).replace(/\*\*/g, '').replace(/(^|；)\*\s*/g, '$1');
  const equipment = (id: string) => items.find(item => item.id === id);
  return <dialog open className="peach-popover peach-inspect unit-dossier" data-cost={cost} aria-label="棋子详情">
    <div className="dossier-eyebrow"><span>✦ 棋子详情</span><span>{owner} · {fielded ? '场上' : '备战'}</span></div>
    <header className="dossier-head">
      <Image unoptimized width={48} height={48} className="dossier-portrait" src={itemImage(unit.id, { label: unit.name })} alt=""/>
      <div className="dossier-identity"><strong>{unit.name}</strong><div><span className="dossier-stars" aria-label={`${terms.star.name} ${starLabel(terms, piece.star)}`}>{starLabel(terms, piece.star)}</span><span className="dossier-role">{ROLES[unit.role]}</span></div></div>
      <b className="dossier-cost">{cost} 费 <span aria-hidden="true">✦</span></b>
      <button type="button" className="dossier-close" aria-label="关闭棋子详情" onClick={onClose}>×</button>
    </header>
    <div className="dossier-traits">{traits.map(id => {
      const trait = findTrait(id); const count = counts.get(id) ?? 0;
      return trait ? <details key={id} className={fielded && activeTier(trait, count) ? 'is-active' : ''}>
        <summary>{trait.name}{fielded ? <b>{count}</b> : null}</summary><p>{trait.ladders}</p>
      </details> : null;
    })}</div>
    <div className="dossier-section-label">{replaying ? '开战面板' : fielded ? '阵容面板' : '备战面板'}<span>✧</span></div>
    <dl className="dossier-stats">{cells.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <section className="dossier-skill">
      <div className="dossier-section-label"><strong>{skill?.name ?? '技能'}</strong>{skill ? <span>{skill.passive || !skill.mana ? '被动' : `${terms.mana.name} ${skill.mana}`}</span> : null}</div>
      {hazardLabels(piece, fielded).map(label => <p className="dossier-risk" key={label}><strong>{label}</strong></p>)}
      {notes.map((note, i) => <p key={i}>{note}</p>)}
    </section>
    <section className="dossier-equipment">
      <div className="dossier-section-label">携带装备<span>{piece.itemIds.length} 件</span></div>
      {piece.itemIds.length ? piece.itemIds.map((id, i) => <div className="dossier-item" key={`${id}-${i}`}><Image unoptimized width={34} height={34} src={itemImage(id, {label:equipment(id)?.name??id})} alt=""/><div><strong>{equipment(id)?.name ?? id}</strong><p>{itemText(id)}</p></div></div>) : <p className="dossier-empty">尚未装备</p>}
      {piece.consumed?.length ? <details className="dossier-consumed"><summary>已使用 · {piece.consumed.length}</summary>{piece.consumed.map((id,i)=><p key={`${id}-${i}`}><strong>{equipment(id)?.name??id}</strong> · {itemText(id)}</p>)}</details> : null}
    </section>
    {actions ? <div className="peach-inspect-actions">{actions}</div> : null}
  </dialog>;
}
