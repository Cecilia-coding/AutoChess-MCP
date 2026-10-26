/** Smooth closed swimming route in artwork coordinates; time is seconds. */
export function fishPose(spec, time, reducedMotion = false) {
  const t = reducedMotion ? 0 : time;
  const direction = spec.direction ?? 1;
  const u = t * Math.PI * 2 / spec.period * direction + (spec.phase ?? 0);
  const [cx, cy] = spec.center, [rx, ry] = spec.radii;
  const x = cx + rx * Math.cos(u);
  const y = cy + ry * Math.sin(u) + 9 * Math.sin(2 * u);
  const dx = -rx * Math.sin(u) * direction;
  const dy = (ry * Math.cos(u) + 18 * Math.cos(2 * u)) * direction;
  return { x, y, angle: Math.atan2(dy, dx) * 180 / Math.PI,
    tail: reducedMotion ? 0 : Math.sin(t * 4.4 + (spec.phase ?? 0)) * 17,
    fin: reducedMotion ? 0 : Math.sin(t * 3.1 + (spec.phase ?? 0)) * 9 };
}

/** Attached before the surface highlights, so fish remain under the water. */
export function makePondFish(svg, defs, config, id, element) {
  if (!config?.fish?.length) return { update() {} };
  const clipId = `pond-water-${id}`;
  const clip = element('clipPath', { id: clipId }, defs);
  element('polygon', { points: config.outline.map(point => point.join(',')).join(' ') }, clip);
  const water = element('g', { class: 'court-pond-fish', 'clip-path': `url(#${clipId})`, 'pointer-events': 'none' }, svg);
  const xs = config.outline.map(point => point[0]), ys = config.outline.map(point => point[1]);
  const bounds = { x: Math.min(...xs) - 24, y: Math.min(...ys) - 24, width: Math.max(...xs) - Math.min(...xs) + 48, height: Math.max(...ys) - Math.min(...ys) + 48 };
  let waterOffset, reflectionOffset, reflectionLight;
  if (config.refraction) {
    const filterId = `pond-refraction-${id}`, maskId = `pond-feather-${id}`, blurId = `pond-edge-${id}`;
    const filter = element('filter', { id: filterId, filterUnits: 'userSpaceOnUse', ...bounds, 'color-interpolation-filters': 'sRGB' }, defs);
    element('feTurbulence', { type: 'fractalNoise', baseFrequency: '.01 .035', numOctaves: 2, seed: 8, result: 'noise' }, filter);
    waterOffset = element('feOffset', { in: 'noise', dx: 0, dy: 0, result: 'flow' }, filter);
    element('feDisplacementMap', { in: 'SourceGraphic', in2: 'flow', scale: config.refraction.strength ?? 7, xChannelSelector: 'R', yChannelSelector: 'G' }, filter);
    const blur = element('filter', { id: blurId }, defs);
    element('feGaussianBlur', { stdDeviation: 9 }, blur);
    const mask = element('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 1024, height: 1024 }, defs);
    element('polygon', { points: config.outline.map(point => point.join(',')).join(' '), fill: 'white', filter: `url(#${blurId})` }, mask);
    const underlay = element('g', { class: 'pond-reflected-water', mask: `url(#${maskId})`, opacity: config.refraction.opacity ?? .9 }, water);
    element('image', { href: config.refraction.image, x: 0, y: 0, width: 1024, height: 1024, filter: `url(#${filterId})`, preserveAspectRatio: 'none' }, underlay);
  }
  const fish = config.fish.map((spec, index) => {
    const gradId = `pond-fish-${id}-${index}`;
    const gradient = element('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    element('stop', { offset: '0%', 'stop-color': spec.light }, gradient);
    element('stop', { offset: '55%', 'stop-color': spec.color }, gradient);
    element('stop', { offset: '100%', 'stop-color': spec.shadow }, gradient);
    const root = element('g', { class: 'pond-fish', opacity: spec.opacity ?? .78 }, water);
    const body = element('g', { transform: `scale(${spec.size ?? 1})` }, root);
    element('path', { d: 'M25 5 C20 -5 1 -6 -17 5 C-2 14 18 15 25 5Z', fill: '#285951', opacity: .13, transform: 'translate(3 5)' }, body);
    const tail = element('g', { class: 'pond-fish-tail' }, body);
    const tailFin = element('path', { class: 'pond-fish-tail-membrane', fill: spec.color, stroke: spec.light, 'stroke-width': .45, opacity: .68 }, tail);
    const tailRays = element('path', { fill: 'none', stroke: spec.light, 'stroke-width': .55, opacity: .5, 'stroke-linecap': 'round' }, tail);
    const fins = [-1, 1].map(side => {
      const fin = element('g', {}, body);
      element('path', { d: `M7 ${side * 4} Q-1 ${side * 18} -9 ${side * 15} L-3 ${side * 4}Z`, fill: spec.light, opacity: .48 }, fin);
      return { node: fin, side };
    });
    element('path', { d: 'M25 0 C23 -8 9 -11 -4 -7 Q-12 -4 -20 0 Q-12 4 -4 7 C9 11 23 8 25 0Z', fill: `url(#${gradId})`, stroke: spec.shadow, 'stroke-width': .65 }, body);
    element('path', { d: 'M17 -2 Q7 -6 -10 0 Q3 -2 13 0Z', fill: spec.light, opacity: .6 }, body);
    element('path', { d: 'M11 -6 Q7 0 11 6', fill: 'none', stroke: spec.shadow, 'stroke-width': .7, opacity: .55 }, body);
    for (const side of [-1, 1]) element('circle', { cx: 19, cy: side * 3.5, r: .9, fill: spec.shadow }, body);
    return { root, tail, tailFin, tailRays, fins, spec };
  });
  // Surface normals produce broken highlights above the fish, with a feathered shoreline.
  if (config.reflection) {
    const reflectionId = `pond-reflection-${id}`;
    const filter = element('filter', { id: reflectionId, filterUnits: 'userSpaceOnUse', ...bounds, 'color-interpolation-filters': 'sRGB' }, defs);
    element('feTurbulence', { type: 'fractalNoise', baseFrequency: '.018 .075', numOctaves: 2, seed: 12, result: 'height' }, filter);
    reflectionOffset = element('feOffset', { in: 'height', dx: 0, dy: 0, result: 'flow' }, filter);
    const light = element('feSpecularLighting', { in: 'flow', surfaceScale: config.reflection.height ?? 4, specularConstant: 1.3, specularExponent: config.reflection.gloss ?? 22, 'lighting-color': config.reflection.color }, filter);
    reflectionLight = element('feDistantLight', { azimuth: 225, elevation: 42 }, light);
    const surface = element('g', { class: 'pond-specular-water', 'clip-path': `url(#${clipId})`, opacity: config.reflection.opacity ?? .3, 'pointer-events': 'none', ...(config.refraction ? { mask: `url(#pond-feather-${id})` } : {}) }, svg);
    element('rect', { ...bounds, fill: 'white', filter: `url(#${reflectionId})` }, surface);
  }
  const caustics = [];
  if (config.surface) {
    const surface = element('g', { class: 'pond-water-shimmer', 'clip-path': `url(#${clipId})`, 'pointer-events': 'none' }, svg);
    const sheenId = `pond-sheen-${id}`;
    const sheen = element('linearGradient', { id: sheenId }, defs);
    for (const [offset, opacity] of [['0%', 0], ['35%', .45], ['60%', 1], ['100%', 0]]) {
      element('stop', { offset, 'stop-color': config.surface.color, 'stop-opacity': opacity }, sheen);
    }
    for (let i = 0; i < (config.surface.count ?? 8); i++) {
      const root = element('g', { class: 'pond-caustic' }, surface);
      const broad = element('path', { fill: 'none', stroke: `url(#${sheenId})`, 'stroke-width': 9, opacity: .16, 'stroke-linecap': 'round' }, root);
      const fine = element('path', { fill: 'none', stroke: `url(#${sheenId})`, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-dasharray': '24 17 9 28 40 21' }, root);
      caustics.push({ root, broad, fine, index: i });
    }
  }
  return { update(time, reducedMotion) {
    for (const { root, tail, tailFin, tailRays, fins, spec } of fish) {
      const pose = fishPose(spec, time, reducedMotion);
      root.setAttribute('transform', `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) rotate(${pose.angle.toFixed(2)})`);
      tail.setAttribute('transform', `rotate(${pose.tail.toFixed(2)} -17 0)`);
      const flutter = reducedMotion ? 0 : Math.sin(time * 4.4 + (spec.phase ?? 0) - .85) * 3;
      // Two rounded, translucent lobes trail behind the narrow tail root.
      tailFin.setAttribute('d', `M-16 0 C-24 -1 -28 -10 -38 ${-11 + flutter} C-48 ${-12 + flutter} -45 ${-3 + flutter} -34 0 C-44 ${4 + flutter} -47 ${15 + flutter} -37 ${12 + flutter} C-26 10 -24 2 -16 0Z`);
      tailRays.setAttribute('d', `M-18 0 Q-29 -3 -40 ${-8 + flutter} M-19 0 Q-30 4 -40 ${9 + flutter} M-22 0 Q-30 1 -34 0`);
      for (const { node, side } of fins) node.setAttribute('transform', `rotate(${(pose.fin * side).toFixed(2)} 4 0)`);
    }
    const t = reducedMotion ? 0 : time;
    if (waterOffset) {
      const phase = t * (config.refraction.speed ?? .5);
      waterOffset.setAttribute('dx', String(Math.sin(phase) * 22));
      waterOffset.setAttribute('dy', String(Math.cos(phase * .73) * 16));
    }
    if (reflectionOffset) {
      const phase = t * (config.reflection.speed ?? .6);
      reflectionOffset.setAttribute('dx', String(Math.sin(phase * .7) * 28));
      reflectionOffset.setAttribute('dy', String(Math.cos(phase) * 18));
      reflectionLight.setAttribute('azimuth', String(225 + Math.sin(phase * .35) * 12));
      reflectionLight.setAttribute('elevation', String(42 + Math.sin(phase * .53) * 6));
    }
    for (const { root, broad, fine, index: i } of caustics) {
      const phase = t * (config.surface.speed ?? .45) + i * 1.8;
      const y = 355 + i * (340 / (config.surface.count ?? 8)) + Math.sin(phase) * 12;
      const x = 329 + Math.sin(phase * .65 + i) * 27;
      const bend = Math.sin(phase + .7) * 22;
      const path = `M${x} ${y} C${x + 85} ${y - 24 + bend} ${x + 116} ${y + 22} ${x + 173} ${y + 4} S${x + 285} ${y - 17 - bend} ${x + 363} ${y + 2}`;
      broad.setAttribute('d', path); fine.setAttribute('d', path);
      root.setAttribute('opacity', String(config.surface.opacity * (.65 + .35 * Math.sin(phase * .7))));
    }
  } };
}
