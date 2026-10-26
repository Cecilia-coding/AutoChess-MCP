/** Authored midpoint, outside the animated wind rotation. */
export function bambooPivot(spec) {
  const angle = (spec.baseAngle ?? 0) * Math.PI / 180;
  const half = (spec.height ?? 500) / 2;
  return [spec.root[0] + Math.sin(angle) * half, spec.root[1] - Math.cos(angle) * half];
}
export function bambooPlacementTransform(spec, placement) {
  const [x, y] = bambooPivot(spec);
  return `translate(${placement.x} ${placement.y}) translate(${x} ${y}) rotate(${placement.rotation}) scale(${placement.scale * placement.flip} ${placement.scale}) translate(${-x} ${-y})`;
}
