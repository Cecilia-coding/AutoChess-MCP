/** Short-lived water rings in artwork coordinates, underneath the pieces. */
export function makeLandingRipples(svg, config, reducedMotion, element) {
  const active = [];
  const clear = () => { for (const item of active) item.root.remove(); active.length = 0; };
  return {
    clear,
    land(x, y) {
      if (!config || reducedMotion || !Number.isFinite(x) || !Number.isFinite(y)) return;
      if (active.length >= 12) active.shift().root.remove();
      const root = element('g', { class: 'court-landing-ripple', transform: `translate(${x} ${y})`, 'pointer-events': 'none' }, svg);
      const rings = [0, 1].map(() => element('ellipse', { cx: 0, cy: 0, rx: 0, ry: 0, fill: 'none', stroke: config.color, opacity: 0 }, root));
      active.push({ root, rings, start: null });
    },
    update(time, enabled) {
      if (!enabled) { clear(); return; }
      const duration = config?.duration ?? 1.65, delay = config?.delay ?? .18;
      for (let i = active.length - 1; i >= 0; i--) {
        const item = active[i];
        item.start ??= time;
        const age = Math.max(0, time - item.start);
        if (age >= duration + delay) { item.root.remove(); active.splice(i, 1); continue; }
        item.rings.forEach((ring, index) => {
          const p = (age - index * delay) / duration;
          const visible = p >= 0 && p < 1;
          const progress = Math.max(0, Math.min(1, p));
          const radius = (config.minRadius ?? 10) + (config.radius ?? 66) * (1 - (1 - progress) ** 1.5);
          ring.setAttribute('rx', String(radius));
          ring.setAttribute('ry', String(radius * (config.aspectRatio ?? .5)));
          ring.setAttribute('stroke-width', String((config.width ?? 2.5) * (1 - progress * .6)));
          ring.setAttribute('opacity', String(visible ? (config.opacity ?? .9) * Math.min(1, progress / .07) * (1 - progress) ** 1.3 : 0));
        });
      }
    },
  };
}

/** Copy coordinates, because callers can mutate their board arrays in place. */
export function makePlacementTracker() {
  let previous = null, wasEditable = false;
  return next => {
    const editable = !!next.editable && !next.battle;
    const changed = [];
    const positions = new Map();
    for (const piece of next.bench ?? []) positions.set(piece.id, null);
    for (const piece of next.board ?? []) {
      const pos = [piece.localRow, piece.localCol];
      const old = previous?.get(piece.id);
      if (editable && wasEditable && previous?.has(piece.id) && (!old || old[0] !== pos[0] || old[1] !== pos[1])) changed.push({ row: pos[0], col: pos[1] });
      positions.set(piece.id, pos);
    }
    previous = positions; wasEditable = editable;
    return changed;
  };
}
