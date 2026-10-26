// Placement sits outside the wind transform, exactly as in the preview editor.
export function frondPivot(template) {
  const end = template.points[3], size = template.size ?? 1;
  return [template.x + end[0] * size * (template.flip ?? 1) * .5, template.y + end[1] * size * .5];
}
export function frondPlacementTransform(template, placement) {
  const [px, py] = frondPivot(template);
  return `translate(${placement.x} ${placement.y}) translate(${px} ${py}) rotate(${placement.rotation}) scale(${placement.scale * placement.flip} ${placement.scale}) translate(${-px} ${-py})`;
}
