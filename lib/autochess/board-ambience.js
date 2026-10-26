import { frondPlacementTransform } from './frond-placement.js';
import { makePondFish } from './pond-life.js';
import { bambooPlacementTransform } from './bamboo-placement.js';
import { makeLandingRipples } from './landing-ripples.js';
import { makeBoardAtmosphere } from './board-atmosphere.js';

const NS = 'http://www.w3.org/2000/svg';
let ambienceId = 0;
function element(tag, attributes = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  parent?.append(node);
  return node;
}
function curve(points, t) {
  const s = 1 - t;
  return [0, 1].map(axis => s ** 3 * points[0][axis] + 3 * s ** 2 * t * points[1][axis] + 3 * s * t ** 2 * points[2][axis] + t ** 3 * points[3][axis]);
}

// Small animated silhouettes share the painting's coordinates, with no new image assets.
export function makeCourtAmbience(stage, before, config = {}, reducedMotion) {
  const svg = element('svg', { viewBox: '0 0 1024 1024', class: 'court-ambience', 'aria-hidden': 'true' });
  stage.insertBefore(svg, before);
  const defs = element('defs', {}, svg);
  const glowId = `court-glow-${++ambienceId}`;
  if (config.veil) {
    const veilId = `court-veil-${ambienceId}`;
    const wash = element('radialGradient', { id: veilId, cx: '.5', cy: '.5', r: '.67' }, defs);
    element('stop', { offset: '0%', 'stop-color': config.veil.color, 'stop-opacity': config.veil.opacity }, wash);
    element('stop', { offset: '62%', 'stop-color': config.veil.color, 'stop-opacity': config.veil.opacity * .86 }, wash);
    element('stop', { offset: '100%', 'stop-color': config.veil.color, 'stop-opacity': 0 }, wash);
    element('polygon', { points: config.veil.points.map(p => p.join(',')).join(' '), fill: `url(#${veilId})` }, svg);
  }
  const gradient = element('radialGradient', { id: glowId }, defs);
  element('stop', { offset: '0%', 'stop-color': config.glowColor ?? '#c22b49', 'stop-opacity': .55 }, gradient);
  element('stop', { offset: '60%', 'stop-color': config.glowColor ?? '#911d34', 'stop-opacity': .24 }, gradient);
  element('stop', { offset: '100%', 'stop-color': config.glowColor ?? '#7a142c', 'stop-opacity': 0 }, gradient);
  const runes = (config.runes ?? []).map(rune => element('ellipse', { cx: rune.x, cy: rune.y, rx: rune.rx, ry: rune.ry, fill: `url(#${glowId})`, class: 'rune-breath' }, svg));
  const dove = config.bird === 'dove';
  const flyers = (config.flights ?? []).map(flight => {
    const root = element('g', { class: 'flying-raven', opacity: 0 }, svg);
    const silhouette = element('g', { fill: dove ? '#fffdf0' : '#090e17', stroke: dove ? '#83958c' : '#3a4659', 'stroke-width': .4, 'stroke-linejoin': 'round' }, root);
    const wings = [-1, 1].map(side => {
      const wing = element('g', {}, silhouette);
      const mirrored = element('g', { transform: `scale(${side} 1)` }, wing);
      element('path', { d: dove ? 'M1,-3 C7,-12 16,-15 24,-9 L21,-3 L18,-5 L17,1 L14,-1 L12,4 L9,2 L6,6 L2,4 Z' : 'M1,-3 C5,-7 10,-7 15,-4 L20,1 L15,-.3 L18,4 L12,1.8 L13,5 L8,2.7 L7,5 L3,2 Z' }, mirrored);
      return wing;
    });
    element('path', { d: dove ? 'M-2,4 L-6,13 Q0,16 6,13 L2,4 Z' : 'M-2,4 L-3,11 L0,9 L3,11 L2,4 Z' }, silhouette);
    element('ellipse', { cx: 0, cy: 0, rx: 2.7, ry: 6 }, silhouette);
    element('circle', { cx: 0, cy: -6, r: 2.5 }, silhouette);
    element('path', { d: 'M-1,-8 L0,-11 L1,-8 Z' }, silhouette);
    return { root, wings, flight };
  });

  const perch = element('g', { transform: `translate(${(config.perch ?? [0, 0]).join(' ')})`, visibility: config.perch ? 'visible' : 'hidden', class: 'perched-raven', fill: '#0a0d15', stroke: '#3d495b', 'stroke-width': .55, 'stroke-linejoin': 'round' }, svg);
  element('path', { d: 'M-2,-5 L-4,0 M3,-4 L4,0 M-5,0 L0,0 M2,0 L7,0', fill: 'none', stroke: '#202838', 'stroke-width': 1.3 }, perch);
  const body = element('g', {}, perch);
  element('path', { d: 'M-3,-10 L-10,-1 L-3,-4 L0,-10 Z' }, body);
  element('ellipse', { cx: 0, cy: -12, rx: 5.5, ry: 8.5, transform: 'rotate(-12 0 -12)' }, body);
  const foldedWing = element('path', { d: 'M-3,-17 Q5,-16 2,-6 Q-5,-7 -3,-17 Z', fill: '#151c28' }, body);
  const head = element('g', {}, body);
  element('circle', { cx: 3, cy: -21, r: 4.3 }, head);
  element('path', { d: 'M6,-22 L12,-19.5 L6,-18.8 Z' }, head);
  element('circle', { cx: 4.6, cy: -22, r: .65, fill: '#8291a4', stroke: 'none' }, head);

  const motes = (config.motes ?? []).map(([x, y]) => element('circle', { cx: x, cy: y, r: config.moteMotion?.radius ?? 2, fill: config.glowColor ?? '#fff4cc' }, svg));
  const orbits = (config.orbits ?? []).map(orbit => ({ ...orbit, node: element('circle', { r: 3, fill: '#fff0b8', stroke: '#d4ac6a', 'stroke-width': .8 }, svg) }));
  const spinners = (config.spinners ?? []).map((spinner, index) => {
    const node = element('g', { class: 'court-spinner' }, svg);
    const color = spinner.color ?? config.glowColor ?? '#fff4cc';
    element('ellipse', { cx: spinner.x, cy: spinner.y, rx: spinner.rx, ry: spinner.ry, fill: 'none', stroke: color, 'stroke-width': (spinner.width ?? 2) * 5, 'stroke-opacity': (spinner.opacity ?? .72) * .12, 'stroke-linecap': 'round', 'stroke-dasharray': spinner.dashes ?? '62 34 12 25' }, node);
    element('ellipse', { cx: spinner.x, cy: spinner.y, rx: spinner.rx, ry: spinner.ry, fill: 'none', stroke: color, 'stroke-width': spinner.width ?? 2, 'stroke-opacity': spinner.opacity ?? .72, 'stroke-linecap': 'round', 'stroke-dasharray': spinner.dashes ?? '62 34 12 25' }, node);
    for (let point = 0; point < 3; point++) {
      const angle = point * Math.PI * 2 / 3 + index * .4;
      element('circle', { cx: spinner.x + Math.cos(angle) * spinner.rx, cy: spinner.y + Math.sin(angle) * spinner.ry, r: spinner.pointSize ?? 3.2, fill: color, opacity: .92 }, node);
    }
    return { ...spinner, node, index };
  });
  const starTracks = [];
  if (config.starfield) {
    const field = config.starfield, clipId = `court-sky-${ambienceId}`;
    const clip = element('clipPath', { id: clipId }, defs);
    element('polygon', { points: field.sky.map(p => p.join(',')).join(' ') }, clip);
    const sky = element('g', { 'clip-path': `url(#${clipId})` }, svg);
    field.radii.forEach((radius, i) => {
      const ring = element('g', {}, sky);
      element('circle', { cx: field.center[0], cy: field.center[1], r: radius, fill: 'none', stroke: '#c3e7ff', 'stroke-width': field.trailWidth ?? .85, 'stroke-opacity': field.trailOpacity ?? .42, 'stroke-dasharray': `${66 + i * 6} ${80 + i * 19} 4 ${60 + i * 11}` }, ring);
      for (let j = 0; j < 3; j++) {
        const angle = (i * .81 + j * 2.1), x = field.center[0] + Math.cos(angle) * radius, y = field.center[1] + Math.sin(angle) * radius;
        element('circle', { cx: x, cy: y, r: 6 * (field.starScale ?? 1), fill: '#b3dfff', opacity: .14 }, ring);
        element('circle', { cx: x, cy: y, r: (j ? 1.4 : 2.2) * (field.starScale ?? 1), fill: '#ecf8ff', opacity: .98 }, ring);
        if (!j) element('path', { d: `M${x-5},${y} h10 M${x},${y-5} v10`, stroke: '#e6f6ff', 'stroke-width': .65, opacity: .6 }, ring);
      }
      starTracks.push({ node: ring, center: field.center, speed: (field.speed ?? 2.4) * (1 - i * .07), phase: i * 17 });
    });
  }

  const pondFish = makePondFish(svg, defs, config.pond, ambienceId, element);
  const atmosphere = makeBoardAtmosphere(svg, defs, config, ambienceId, element);
  const ripples = [];
  if (config.ripples) {
    const ripGroup = element('g', { class: 'court-ripples' }, svg);
    const ripDefs = element('defs', {}, ripGroup);
    const rGradId = `ripple-grad-${ambienceId}`;
    const rGrad = element('linearGradient', { id: rGradId, x1: '0', y1: '0', x2: '1', y2: '0' }, ripDefs);
    element('stop', { offset: '0%', 'stop-color': config.ripples.color ?? '#a2ede0', 'stop-opacity': 0.2 }, rGrad);
    element('stop', { offset: '50%', 'stop-color': config.ripples.color ?? '#a2ede0', 'stop-opacity': 1 }, rGrad);
    element('stop', { offset: '100%', 'stop-color': config.ripples.color ?? '#a2ede0', 'stop-opacity': 0.2 }, rGrad);

    const { center = [512, 516], count = 5, minRadius = 16, maxRadius = 185, aspectRatio = 0.52, opacity = 0.55, width = 1.8, speed = 0.16 } = config.ripples;
    for (let i = 0; i < count; i++) {
      const node = element('ellipse', {
        cx: center[0], cy: center[1],
        rx: minRadius, ry: minRadius * aspectRatio,
        fill: 'none',
        stroke: `url(#${rGradId})`,
        'stroke-width': width,
        'stroke-opacity': 0,
      }, ripGroup);
      ripples.push({ node, index: i, count, minRadius, maxRadius, aspectRatio, opacity, width, speed });
    }
  }

  const waterStreams = [];
  if (config.waterFlow) {
    const flowGroup = element('g', { class: 'court-water-flow' }, svg);
    const flowDefs = element('defs', {}, flowGroup);
    const gradId = `water-flow-${ambienceId}`;
    const flowGrad = element('linearGradient', { id: gradId, x1: '0', y1: '0', x2: '1', y2: '0' }, flowDefs);
    element('stop', { offset: '0%', 'stop-color': config.waterFlow.color ?? '#b8ede0', 'stop-opacity': 0 }, flowGrad);
    element('stop', { offset: '30%', 'stop-color': config.waterFlow.color ?? '#b8ede0', 'stop-opacity': 0.4 }, flowGrad);
    element('stop', { offset: '70%', 'stop-color': config.waterFlow.color ?? '#b8ede0', 'stop-opacity': 0.35 }, flowGrad);
    element('stop', { offset: '100%', 'stop-color': config.waterFlow.color ?? '#b8ede0', 'stop-opacity': 0 }, flowGrad);

    (config.waterFlow.streams ?? []).forEach((stream, i) => {
      const [p0, p1, p2, p3] = stream.points;
      const path = element('path', {
        d: `M${p0.join(',')} C${p1.join(',')} ${p2.join(',')} ${p3.join(',')}`,
        fill: 'none',
        stroke: `url(#${gradId})`,
        'stroke-width': stream.width ?? 1.4,
        'stroke-linecap': 'round',
        opacity: stream.opacity ?? 0.25,
        ...(stream.dash ? { 'stroke-dasharray': stream.dash } : {}),
      }, flowGroup);
      waterStreams.push({ path, stream, index: i });
    });
  }

  const foreground = config.fronds?.length || config.atmosphere || config.bamboos?.length || config.fallingLeaves?.length ? element('svg', { viewBox: '0 0 1024 1024', 'aria-hidden': 'true', style: 'position:absolute;inset:0;width:100%;height:100%;z-index:5;pointer-events:none;overflow:hidden' }, stage) : null;
  // Independent foreground sprigs: the original painting stays completely still.
  // Each stem and all its leaves share one anchored transform, so they stay joined.
  let nextFrondId = 0;
  function createFrond(frond) {
    const index = nextFrondId++;
    const host = frond.placement ? element('g', { class: 'court-frond-layout', transform: frondPlacementTransform(frond, frond.placement) }, foreground) : null;
    const node = element('g', { class: 'court-frond', opacity: frond.opacity ?? .9 }, host ?? foreground);
    const leafId = `court-frond-${ambienceId}-${index}`;
    const localDefs = element('defs', {}, node);
    const leafLight = element('linearGradient', { id: leafId, x1: '0', y1: '0', x2: '0', y2: '1' }, localDefs);
    element('stop', { offset: '0%', 'stop-color': frond.light }, leafLight);
    element('stop', { offset: '48%', 'stop-color': frond.color }, leafLight);
    element('stop', { offset: '100%', 'stop-color': frond.shadow }, leafLight);
    const [start, c1, c2, end] = frond.points;
    const stemPath = `M${start.join(',')} C${c1.join(',')} ${c2.join(',')} ${end.join(',')}`;
    element('path', { d: stemPath, fill: 'none', stroke: frond.shadow, 'stroke-width': 2.1, 'stroke-linecap': 'round' }, node);
    element('path', { d: stemPath, fill: 'none', stroke: frond.light, 'stroke-width': .65, opacity: .65 }, node);
    const leafCount = frond.leafCount ?? 9;
    for (let i = 0; i < leafCount; i++) {
      const t = .18 + i * (.76 / Math.max(1, leafCount - 1)), [x, y] = curve(frond.points, t);
      const next = curve(frond.points, Math.min(1, t + .01));
      const angle = Math.atan2(next[1] - y, next[0] - x) * 180 / Math.PI;
      for (const side of [-1, 1]) {
        const length = (frond.leafLength ?? 44) * (1 - i * .035) * (side === 1 ? .94 : 1);
        const width = length * (frond.leafWidth ?? .23);
        const leaf = element('g', { transform: `translate(${x} ${y}) rotate(${angle + side * ((frond.leafAngle ?? 47) + i % 3 * 5)})` }, node);
        element('path', { d: `M0,0 C${length * .3},${-width} ${length * .78},${-width} ${length},0 C${length * .65},${width * .65} ${length * .3},${width} 0,0Z`, fill: `url(#${leafId})`, stroke: frond.light, 'stroke-width': .35 }, leaf);
        element('path', { d: `M0,0 Q${length * .45},${-width * .15} ${length * .9},0`, fill: 'none', stroke: frond.light, 'stroke-width': .55, opacity: .6 }, leaf);
      }
    }
    return { ...frond, node, host: host ?? node };
  }
  const fronds = config.frondLayout
    ? config.frondLayout.items.filter(item => config.fronds?.[item.template]).map((placement, index) => {
      const template = config.fronds[placement.template];
      return createFrond({ ...template, placement, phase: (template.phase ?? 0) + index * .8 });
    })
    : (config.fronds ?? []).map(createFrond);
  if (config.atmosphere) {
    const air = config.atmosphere, airId = `court-air-${ambienceId}`;
    const airDefs = element('defs', {}, foreground);
    const light = element('linearGradient', { id: airId, x1: '0', y1: '0', x2: '0', y2: '1' }, airDefs);
    element('stop', { offset: '0%', 'stop-color': air.top, 'stop-opacity': air.opacity }, light);
    element('stop', { offset: '48%', 'stop-color': air.top, 'stop-opacity': air.opacity * .62 }, light);
    element('stop', { offset: '100%', 'stop-color': air.bottom, 'stop-opacity': air.opacity }, light);
    element('rect', { width: 1024, height: 1024, fill: `url(#${airId})` }, foreground);
  }

  const bambooStalks = [];
  let createBamboo;
  if (config.bamboos?.length) {
    const bambooGroup = element('g', { class: 'court-bamboos' }, foreground ?? svg);
    const bambooDefs = element('defs', {}, bambooGroup);
    const culmGradId = `bamboo-culm-${ambienceId}`;
    const culmGrad = element('linearGradient', { id: culmGradId, x1: '0', y1: '0', x2: '1', y2: '0' }, bambooDefs);
    element('stop', { offset: '0%', 'stop-color': '#426848' }, culmGrad);
    element('stop', { offset: '35%', 'stop-color': '#6c9672' }, culmGrad);
    element('stop', { offset: '80%', 'stop-color': '#35563a' }, culmGrad);
    element('stop', { offset: '100%', 'stop-color': '#1f3523' }, culmGrad);

    const leafGradId = `bamboo-leaf-${ambienceId}`;
    const leafGrad = element('linearGradient', { id: leafGradId, x1: '0', y1: '0', x2: '0', y2: '1' }, bambooDefs);
    element('stop', { offset: '0%', 'stop-color': '#78a679' }, leafGrad);
    element('stop', { offset: '45%', 'stop-color': '#3e6345' }, leafGrad);
    element('stop', { offset: '100%', 'stop-color': '#203824' }, leafGrad);

    let nextBambooId = 0;
    createBamboo = (spec, placement) => {
      const stalkIdx = nextBambooId++;
      const root = spec.root;
      const height = spec.height ?? 500;
      const width = spec.width ?? 7;
      const segments = spec.segments ?? 6;
      const segHeight = height / segments;

      const layoutHost = element('g', { class: 'bamboo-layout', ...(placement ? { transform: bambooPlacementTransform(spec, placement) } : {}) }, bambooGroup);
      const stalkHost = element('g', {
        class: 'bamboo-stalk',
        transform: `translate(${root[0]}, ${root[1]}) rotate(${spec.baseAngle ?? 0})`,
      }, layoutHost);

      for (let s = 0; s < segments; s++) {
        const yTop = -(s + 1) * segHeight;
        const yBot = -s * segHeight;
        const segW = width * (1 - s * 0.045);
        element('rect', {
          x: -segW / 2, y: yTop + 2,
          width: segW, height: segHeight - 3,
          rx: 1.5,
          fill: `url(#${culmGradId})`,
        }, stalkHost);
        element('ellipse', {
          cx: 0, cy: yBot,
          rx: segW / 2 + 1.2, ry: 1.8,
          fill: '#1f3423', stroke: '#8fa878', 'stroke-width': 0.6,
        }, stalkHost);
      }
      element('ellipse', {
        cx: 0, cy: -height,
        rx: width * 0.38, ry: 1.5,
        fill: '#1f3423', stroke: '#8fa878', 'stroke-width': 0.6,
      }, stalkHost);

      const clusters = [];
      (spec.clusters ?? []).forEach((cSpec, cIdx) => {
        const nodeY = -cSpec.node * segHeight;
        const side = cSpec.side ?? 1;
        const branchGroup = element('g', {
          class: 'bamboo-branch',
          transform: `translate(${side * (width * 0.35)}, ${nodeY}) rotate(${cSpec.angle ?? 25})`,
        }, stalkHost);

        const twigLen = cSpec.twigLength ?? 32;
        const twigPath = `M0,0 Q${side * twigLen * 0.4},${-twigLen * 0.3} ${side * twigLen},${-twigLen * 0.15}`;
        element('path', {
          d: twigPath, fill: 'none', stroke: '#2e4933', 'stroke-width': 1.1, 'stroke-linecap': 'round',
        }, branchGroup);

        const fanGroup = element('g', {
          transform: `translate(${side * twigLen}, ${-twigLen * 0.15})`,
        }, branchGroup);

        const leafCount = cSpec.leafCount ?? 4;
        const leafAngles = [-46, 28, -18, 48, 5].slice(0, leafCount);
        const mirroredLeaves = element('g', { class: 'bamboo-leaf-spray', transform: `scale(${side} 1)` }, fanGroup);

        leafAngles.forEach((lAngle, lIdx) => {
          const leafLen = (cSpec.leafLength ?? 48) * (1 - Math.abs(lIdx - leafCount / 2) * 0.12);
          const leafW = leafLen * 0.105;
          const leafG = element('g', { transform: `translate(${lIdx * 4 - 6} ${-lIdx * 1.2}) rotate(${lAngle})` }, mirroredLeaves);
          element('path', {
            d: `M0,0 C${leafLen * 0.25},${-leafW} ${leafLen * 0.72},${-leafW * 0.45} ${leafLen},0 C${leafLen * 0.72},${leafW * 0.45} ${leafLen * 0.25},${leafW} 0,0Z`,
            fill: `url(#${leafGradId})`,
            stroke: '#769e75',
            'stroke-width': 0.3,
          }, leafG);
          element('path', {
            d: `M0,0 Q${leafLen * 0.5},${-leafW * 0.1} ${leafLen * 0.88},0`,
            fill: 'none', stroke: '#8bb58b', 'stroke-width': 0.5, opacity: 0.55,
          }, leafG);
        });

        clusters.push({ branchGroup, fanGroup, spec: cSpec, side, stalkIdx, cIdx });
      });

      bambooStalks.push({ stalkHost, layoutHost, spec, root, clusters, stalkIdx });
      return stalkHost;
    };
    if (config.bambooLayout) {
      config.bambooLayout.items.forEach(item => { if (config.bamboos[item.template]) createBamboo(config.bamboos[item.template], item); });
    } else config.bamboos.forEach(spec => createBamboo(spec));
  }

  const fallingLeaves = [];
  if (config.fallingLeaves?.length) {
    const leafDefs = element('defs', {}, svg);
    const driftGradId = `falling-leaf-${ambienceId}`;
    const dGrad = element('linearGradient', { id: driftGradId }, leafDefs);
    element('stop', { offset: '0%', 'stop-color': config.fallingLeafStyle?.light ?? '#75a372' }, dGrad);
    element('stop', { offset: '100%', 'stop-color': config.fallingLeafStyle?.shadow ?? '#335639' }, dGrad);

    config.fallingLeaves.forEach((spec, i) => {
      const node = element('g', { class: 'falling-bamboo-leaf', opacity: 0 }, foreground ?? svg);
      element('path', {
        d: 'M0,0 C12,-4 32,-3 44,0 C32,3 12,4 0,0Z',
        fill: `url(#${driftGradId})`,
        stroke: config.fallingLeafStyle?.edge ?? '#8fb58a',
        'stroke-width': 0.35,
      }, node);
      fallingLeaves.push({ node, spec, index: i });
    });
  }

  const landingRipples = makeLandingRipples(svg, config.landingRipple, reducedMotion, element);
  let origin = 0;
  let lastUpdate = -Infinity;
  return {
    land(x, y) { landingRipples.land(x, y); },
    addBamboo(template) {
      const source = config.bamboos?.[template];
      return source && createBamboo ? createBamboo(source) : null;
    },
    removeBamboo(node) {
      const index = bambooStalks.findIndex(stalk => stalk.stalkHost === node);
      if (index >= 0) { const stalk = bambooStalks.splice(index, 1)[0]; node.remove(); stalk.layoutHost.remove(); }
    },
    addFrond(template) {
      const source = config.fronds?.[template];
      if (!source || !foreground) return null;
      const frond = createFrond({ ...source, phase: (source.phase ?? 0) + nextFrondId * .8 });
      foreground.insertBefore(frond.node, foreground.querySelector(':scope > rect'));
      fronds.push(frond);
      return frond.node;
    },
    removeFrond(node) {
      const index = fronds.findIndex(frond => frond.node === node);
      if (index >= 0) fronds.splice(index, 1)[0].host.remove();
      else node.remove();
    },
    restart(time) { origin = time; landingRipples.clear(); },
    update(time, enabled) {
      svg.style.display = enabled ? '' : 'none';
      if (foreground) foreground.style.display = enabled ? '' : 'none';
      if (!enabled) landingRipples.clear();
      if (!enabled) return;
      if (time - lastUpdate < 1 / 30 && time >= lastUpdate) return;
      lastUpdate = time;
      landingRipples.update(time, enabled);
      const t = reducedMotion ? 0 : Math.max(0, time - origin);
      pondFish.update(t, reducedMotion);
      atmosphere.update(t);
      for (const { root, wings, flight } of flyers) {
        const age = t % 38 - flight.start;
        const active = !reducedMotion && age >= 0 && age <= flight.duration;
        root.setAttribute('visibility', active ? 'visible' : 'hidden');
        if (!active) continue;
        const u = age / flight.duration;
        const [x, y] = curve(flight.points, u);
        const next = curve(flight.points, Math.min(1, u + .005));
        const angle = Math.atan2(next[1] - y, next[0] - x) * 180 / Math.PI + 90;
        root.setAttribute('transform', `translate(${x.toFixed(2)} ${(y + Math.sin(age * 2.1) * 2).toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${flight.size})`);
        root.setAttribute('opacity', String(Math.min(1, age / .8, (flight.duration - age) / .8) * .92));
        // Short flapping bursts alternate with a held, outstretched glide.
        const beat = age % 3.7;
        const spread = beat < 1.55 ? .25 + .75 * (.5 + .5 * Math.cos(beat * 12)) : .96;
        wings.forEach((wing, index) => wing.setAttribute('transform', `scale(${spread.toFixed(3)} 1) rotate(${(index ? 1 : -1) * (1 - spread) * 16})`));
      }
      const glance = t % 13;
      const turn = glance > 7 && glance < 8.5 ? Math.sin((glance - 7) / 1.5 * Math.PI) * 18 : 0;
      head.setAttribute('transform', `rotate(${turn.toFixed(2)} 2 -17)`);
      body.setAttribute('transform', `translate(0 ${(Math.sin(t * 1.6) * .25).toFixed(2)})`);
      const ruffle = t % 19;
      foldedWing.setAttribute('transform', `rotate(${ruffle > 12 && ruffle < 13 ? Math.sin((ruffle - 12) * Math.PI) * 8 : 0} -2 -16)`);
      runes.forEach((rune, index) => rune.setAttribute('opacity', String(.3 + Math.sin(t * .55 + index * 2) * .13)));
      if (config.runeMotion) runes.forEach((rune, index) => {
        const pulse = Math.sin(t * (config.runeMotion.speed ?? .8) + index * 1.7);
        const scale = 1 + pulse * (config.runeMotion.scale ?? .08);
        const source = config.runes[index];
        rune.setAttribute('transform', `translate(${source.x} ${source.y}) scale(${scale.toFixed(3)}) translate(${-source.x} ${-source.y})`);
        rune.setAttribute('opacity', String((config.runeMotion.opacity ?? .55) + pulse * (config.runeMotion.swing ?? .25)));
      });
      motes.forEach((node, i) => {
        const motion = config.moteMotion ?? {};
        const speed = motion.speed ?? 1;
        node.setAttribute('opacity', String((motion.opacity ?? .42) + (motion.swing ?? .28) * Math.sin(t * .7 * speed + i * 1.7)));
        node.setAttribute('transform', `translate(${(Math.sin(t * .23 * speed + i) * (motion.x ?? 5)).toFixed(2)} ${(Math.sin(t * .31 * speed + i) * (motion.y ?? 8)).toFixed(2)})`);
      });
      orbits.forEach((o, i) => {
        const angle = t * o.speed + i * 2;
        o.node.setAttribute('cx', String(o.x + Math.cos(angle) * o.rx));
        o.node.setAttribute('cy', String(o.y + Math.sin(angle) * o.ry));
      });
      spinners.forEach(spinner => spinner.node.setAttribute('transform', `rotate(${(t * spinner.speed + (spinner.phase ?? spinner.index * 23)).toFixed(2)} ${spinner.x} ${spinner.y})`));
      starTracks.forEach(track => track.node.setAttribute('transform', `rotate(${t * track.speed + track.phase} ${track.center.join(' ')})`));
      ripples.forEach(rip => {
        const p = (t * rip.speed + rip.index / rip.count) % 1;
        const rx = rip.minRadius + p * (rip.maxRadius - rip.minRadius);
        const ry = rx * rip.aspectRatio;
        const op = p < 0.2 ? (p / 0.2) * rip.opacity : (1 - (p - 0.2) / 0.8) * rip.opacity;
        rip.node.setAttribute('rx', rx.toFixed(2));
        rip.node.setAttribute('ry', ry.toFixed(2));
        rip.node.setAttribute('stroke-opacity', op.toFixed(3));
        rip.node.setAttribute('stroke-width', (rip.width * (1 - p * 0.45)).toFixed(2));
      });
      waterStreams.forEach(({ path, stream, index }) => {
        const speed = stream.speed ?? 0.12;
        const breath = 0.5 + 0.5 * Math.sin(t * (speed * 6) + index * 1.7);
        const drift = Math.sin(t * speed * 2 + index) * (stream.driftY ?? 2.5);
        const driftX = Math.cos(t * speed * 1.7 + index * .8) * (stream.driftX ?? 0);
        path.setAttribute('opacity', String(((stream.opacity ?? 0.25) * (0.6 + 0.4 * breath)).toFixed(3)));
        path.setAttribute('transform', `translate(${driftX.toFixed(2)}, ${drift.toFixed(2)})`);
        if (stream.dash) path.setAttribute('stroke-dashoffset', String((-t * (stream.flow ?? 18)).toFixed(2)));
      });
      bambooStalks.forEach(b => {
        const speed = b.spec.speed ?? 0.55;
        const sway = b.spec.sway ?? 3.2;
        const phase = b.spec.phase ?? 0;
        const baseAngle = b.spec.baseAngle ?? 0;
        const wind = Math.sin(t * speed + phase) + 0.28 * Math.sin(t * speed * 2.1 + phase * 1.6);
        const currentAngle = baseAngle + (reducedMotion ? 0 : wind * sway);
        b.stalkHost.setAttribute('transform', `translate(${b.root[0]}, ${b.root[1]}) rotate(${currentAngle.toFixed(2)})`);

        b.clusters.forEach(({ fanGroup, spec, cIdx }) => {
          const fSpeed = speed * 2.6;
          const fPhase = phase + cIdx * 1.1;
          const flutter = Math.sin(t * fSpeed + fPhase) * 4.2;
          fanGroup.setAttribute('transform', `translate(${spec.side * (spec.twigLength ?? 32)}, ${-(spec.twigLength ?? 32) * 0.15}) rotate(${reducedMotion ? 0 : flutter.toFixed(2)})`);
        });
      });
      fallingLeaves.forEach(({ node, spec }) => {
        const duration = spec.duration ?? 14;
        const progress = ((t + (spec.delay ?? 0)) % duration) / duration;
        const phase = spec.phase ?? 0;
        const size = spec.size ?? 1;
        const x = spec.start[0] + progress * (spec.end[0] - spec.start[0]) + Math.sin(progress * Math.PI * 4 + phase) * 24;
        const y = spec.start[1] + progress * (spec.end[1] - spec.start[1]);
        const rot = progress * 360 * (phase % 2 < 1 ? 1 : -1) + Math.sin(t * 1.3 + phase) * 28;
        const minTilt = config.fallingLeafStyle?.minTilt ?? .3;
        const tilt = minTilt + (1 - minTilt) * Math.abs(Math.cos(t * 1.5 + phase));
        const op = Math.sin(progress * Math.PI) * (spec.opacity ?? 0.75);
        node.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${size} ${(size * tilt).toFixed(3)})`);
        node.setAttribute('opacity', reducedMotion ? '0' : op.toFixed(2));
      });
      fronds.forEach(frond => {
        const phase = t * (frond.speed ?? .7) + (frond.phase ?? 0);
        const breeze = .8 * Math.sin(phase) + .2 * Math.sin(phase * 2.3);
        const angle = (frond.angle ?? 0) + (reducedMotion ? 0 : breeze * (frond.sway ?? 3));
        const size = frond.size ?? 1;
        frond.node.setAttribute('transform', `translate(${frond.x} ${frond.y}) rotate(${angle}) scale(${size * (frond.flip ?? 1)} ${size})`);
      });
    },
  };
}
