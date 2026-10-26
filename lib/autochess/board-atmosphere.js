/** Local lights, soft fog banks and underwater shafts, in artwork coordinates. */
export function makeBoardAtmosphere(svg, defs, config, id, element) {
  const glowNodes = (config.localGlows ?? []).map((spec, index) => {
    const gradientId = `local-light-${id}-${index}`;
    const gradient = element('radialGradient', { id: gradientId }, defs);
    for (const [offset, opacity] of [[0, .95], [28, .7], [58, .26], [100, 0]]) {
      element('stop', { offset: `${offset}%`, 'stop-color': spec.color, 'stop-opacity': opacity }, gradient);
    }
    const node = element('ellipse', { class: 'court-local-glow', cx: spec.x, cy: spec.y, rx: spec.rx, ry: spec.ry, fill: `url(#${gradientId})`, style: 'mix-blend-mode:screen' }, svg);
    let detail;
    if (config.localGlowArtwork) {
      // Relight the exact artwork pixels so petal edges remain crisp at peak brightness.
      const maskId = `local-detail-mask-${id}-${index}`, lightId = `local-detail-light-${id}-${index}`;
      const maskGradientId = `local-detail-fade-${id}-${index}`;
      const fade = element('radialGradient', { id: maskGradientId }, defs);
      for (const [offset, opacity] of [[0, 1], [65, 1], [100, 0]]) element('stop', { offset: `${offset}%`, 'stop-color': 'white', 'stop-opacity': opacity }, fade);
      const mask = element('mask', { id: maskId, maskUnits: 'userSpaceOnUse', x: spec.x - spec.rx, y: spec.y - spec.ry, width: spec.rx * 2, height: spec.ry * 2 }, defs);
      element('ellipse', { cx: spec.x, cy: spec.y, rx: spec.rx, ry: spec.ry, fill: `url(#${maskGradientId})` }, mask);
      const filter = element('filter', { id: lightId, filterUnits: 'userSpaceOnUse', x: spec.x - spec.rx, y: spec.y - spec.ry, width: spec.rx * 2, height: spec.ry * 2, 'color-interpolation-filters': 'sRGB' }, defs);
      const transfer = element('feComponentTransfer', {}, filter);
      for (const channel of ['R', 'G', 'B']) element(`feFunc${channel}`, { type: 'linear', slope: 1.35, intercept: .025 }, transfer);
      detail = element('g', { class: 'court-local-light-detail', mask: `url(#${maskId})` }, svg);
      element('image', { href: config.localGlowArtwork, x: 0, y: 0, width: 1024, height: 1024, preserveAspectRatio: 'none', filter: `url(#${lightId})` }, detail);
    }
    return { node, detail, spec };
  });

  const fogNodes = (config.fogBanks ?? []).map((spec, index) => {
    const gradientId = `fog-bank-${id}-${index}`;
    const gradient = element('radialGradient', { id: gradientId }, defs);
    for (const [offset, opacity] of [[0, .85], [38, .65], [72, .22], [100, 0]]) {
      element('stop', { offset: `${offset}%`, 'stop-color': spec.color ?? '#ffffff', 'stop-opacity': opacity }, gradient);
    }
    const node = element('g', { class: 'court-fog-bank' }, svg);
    // Uneven overlapping wisps make a continuous cloud with feathered edges.
    for (let i = 0; i < 5; i++) {
      element('ellipse', { cx: (i - 2) * spec.rx * .33, cy: Math.sin(i * 2.1) * spec.ry * .22,
        rx: spec.rx * (.55 + i % 2 * .15), ry: spec.ry * (.7 + i % 3 * .15), fill: `url(#${gradientId})` }, node);
    }
    return { node, spec };
  });

  const shafts = (config.lightShafts ?? []).map((spec, index) => {
    const gradientId = `light-shaft-${id}-${index}`, blurId = `shaft-soft-${id}-${index}`;
    const gradient = element('linearGradient', { id: gradientId, x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
    for (const [offset, opacity] of [[0, .2], [14, .8], [48, .4], [100, 0]]) {
      element('stop', { offset: `${offset}%`, 'stop-color': spec.color ?? '#c9fff2', 'stop-opacity': opacity }, gradient);
    }
    const blur = element('filter', { id: blurId, x: '-100%', y: '-20%', width: '300%', height: '140%' }, defs);
    element('feGaussianBlur', { stdDeviation: spec.blur ?? 8 }, blur);
    const node = element('g', { class: 'court-light-shaft', style: 'mix-blend-mode:screen' }, svg);
    const w = spec.width, length = spec.length;
    element('path', { d: `M${-w * .12} 0 L${w * .12} 0 L${w} ${length} Q0 ${length * 1.08} ${-w} ${length} Z`, fill: `url(#${gradientId})`, filter: `url(#${blurId})` }, node);
    return { node, spec };
  });

  const bubbles = (config.bubbleStreams ?? []).flatMap((spec, streamIndex) => {
    return Array.from({ length: spec.count ?? 6 }, (_, index) => {
      const radius = (spec.radius ?? 7) * (.6 + ((index * 7 + streamIndex * 3) % 11) / 11 * .8);
      const node = element('g', { class: 'court-bubble' }, svg);
      element('circle', { r: radius, fill: spec.color ?? '#cafff4', 'fill-opacity': .035, stroke: spec.color ?? '#cafff4', 'stroke-width': 1.25, 'stroke-opacity': .7 }, node);
      element('path', { d: `M${-radius * .66} ${-radius * .1} A${radius * .7} ${radius * .7} 0 0 1 ${-radius * .08} ${-radius * .72}`, fill: 'none', stroke: '#f0fffc', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, node);
      return { node, spec, index, phase: index / (spec.count ?? 6) + streamIndex * .137 };
    });
  });

  return { update(t) {
    glowNodes.forEach(({ node, detail, spec }) => {
      const wave = .5 + .5 * Math.sin(t * (spec.speed ?? 1.25) + (spec.phase ?? 0));
      const scale = .82 + wave * .32;
      node.setAttribute('opacity', String(detail ? .04 + wave * .14 : .12 + wave * (spec.opacity ?? .8)));
      detail?.setAttribute('opacity', String(.45 + wave * .55));
      node.setAttribute('transform', `translate(${spec.x} ${spec.y}) scale(${scale}) translate(${-spec.x} ${-spec.y})`);
    });
    fogNodes.forEach(({ node, spec }) => {
      const phase = t * (spec.speed ?? .4) + (spec.phase ?? 0);
      const x = spec.x + Math.sin(phase) * (spec.driftX ?? 45);
      const y = spec.y + Math.cos(phase * .8) * (spec.driftY ?? 14);
      node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${Math.sin(phase * .7) * 5}) scale(${1 + Math.sin(phase + 1) * .12} ${1 + Math.cos(phase) * .18})`);
      node.setAttribute('opacity', String((spec.opacity ?? .55) * (.72 + .28 * Math.sin(phase + .8))));
    });
    shafts.forEach(({ node, spec }) => {
      const phase = t * (spec.speed ?? .4) + (spec.phase ?? 0);
      const angle = (spec.angle ?? 0) + Math.sin(phase) * (spec.sweep ?? 9);
      node.setAttribute('transform', `translate(${spec.x} ${spec.y}) rotate(${angle.toFixed(2)})`);
      node.setAttribute('opacity', String((spec.opacity ?? .5) * (.7 + .3 * Math.sin(phase * 1.6))));
    });
    bubbles.forEach(({ node, spec, index, phase }) => {
      const progress = (t / (spec.duration ?? 12) + phase) % 1;
      const x = spec.x + Math.sin(progress * Math.PI * 3 + index * 2) * (spec.drift ?? 14);
      const y = spec.bottom + (spec.top - spec.bottom) * progress;
      const alpha = Math.min(1, progress * 9, (1 - progress) * 7) * (spec.opacity ?? .85);
      node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(.75 + progress * .35).toFixed(3)})`);
      node.setAttribute('opacity', alpha.toFixed(3));
    });
  } };
}
