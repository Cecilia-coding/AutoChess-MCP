'use strict';
// All artwork is rendered on a 24×24 grid; bodies and faces are separate from feet.
window.Mascots = (() => {
  const ink = '#282233';
  const definitions = [
    ['claude', 'Claude', '#ef9362', 'melee'],
    ['gpt', 'GPT', '#dfe5e2', 'support'],
    ['codex', 'Codex', '#f4f4ef', 'ranged'],
    ['deepseek', 'DeepSeek', '#6c95f7', 'caster'],
    ['gemini', 'Gemini', '#a688f7', 'caster'],
    ['grok', 'Grok', '#7f8798', 'melee'],
    ['kimi', 'Kimi', '#6594f7', 'ranged'],
    ['qwen', 'Qwen', '#ad7ef0', 'caster'],
    ['glm', 'GLM', '#5f96f7', 'caster'],
    ['minimax', 'MiniMax', '#f79672', 'caster'],
    ['characterai', 'Character.AI', '#dcd8e2', 'support'],
    ['replika', 'Replika', '#e2b3f2', 'support'],
    ['talkie', 'Talkie', '#f7cb68', 'ranged'],
    ['xiaoice', 'Xiaoice', '#95e5ec', 'support'],
    ['doubao', '豆包', '#ef6868', 'caster'],
    ['llama', 'Llama', '#b299f5', 'ranged'],
    ['mistral', 'Mistral', '#f5a256', 'ranged'],
    ['copilot', 'Copilot', '#72cee8', 'support'],
    ['ernie', 'ERNIE', '#9385f2', 'caster'],
    ['hunyuan', 'Hunyuan', '#7ae0b2', 'caster'],
    ['musespark', 'Muse', '#e2ccaa', 'ranged'],
    ['nai', 'Nai', '#b17de8', 'caster'],
    ['tripo', 'Tripo', '#72dec6', 'caster'],
    ['manus', 'Manus', '#faf2e4', 'melee'],
    ['kiro', 'Kiro', '#c394f0', 'melee'],
    ['jimeng', '即梦', '#ef7ec8', 'caster'],
    ['gemma', 'Gemma', '#80d2ea', 'caster'],
    ['kling', 'Kling', '#b4eb5e', 'caster'],
    ['ollama', 'Ollama', '#f5e8d5', 'support'],
  ];
  const units = definitions.map(([id, name, color, role]) => ({ id, name, color, role }));

  const gptRows = [
    '.....kkkk.......',
    '....kwwwwkkkk...',
    '...kwwwkkwwwwk..',
    '..kkwkkwwwkwwkk.',
    '.kwkwkwwkkwkwwk.',
    'kwwkwkwkkwwwkkk.',
    'kwwkwkkwwkkwwwk.',
    'kwwkwkwwwwkkkwwk',
    'kwwkkkwwwwkwkwwk',
    '.kwwwkkwwkkwkwwk',
    '.kkkwwwkkwkwkwwk',
    '.kwwkkkwwwkwkwk.',
    '..kwwwwwwkwwkk..',
    '..kkwwwkkwwwk...',
    '...kkkkkwwwk....',
    '........kkk.....',
  ];

  const qwenRows = [
    '.......####.........',
    '......#.###.........',
    '.....##.#########...',
    '.....#..##########..',
    '....#...##########..',
    '.####...###########.',
    '###..............#..',
    '###..............#..',
    '####...######....#..',
    '.####..######....##.',
    '.####...####...#..#.',
    '..####...##...##...#',
    '..####...##...######',
    '..#####......#######',
    '.######......######.',
    '..##........######..',
    '..##.......####.....',
    '...######..####.....',
    '.........#####......',
    '.........#####......',
  ];

  function addCardinalOutline(canvas, outlineColor = ink) {
    const g = canvas.getContext('2d');
    const src = g.getImageData(0, 0, 24, 24);
    const d = src.data;
    const alpha = (x, y) => (x >= 0 && x < 24 && y >= 0 && y < 24 ? d[(y * 24 + x) * 4 + 3] : 0);
    const out = [];
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 24; x++) {
        if (!alpha(x, y) && (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1))) {
          out.push([x, y]);
        }
      }
    }
    g.fillStyle = outlineColor;
    for (const [x, y] of out) g.fillRect(x, y, 1, 1);
  }

  function make(unit) {
    const c = document.createElement('canvas');
    c.width = c.height = 24;
    const g = c.getContext('2d');
    const rect = (x, y, w, h, color) => {
      g.fillStyle = color;
      g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };
    const pix = (x, y, color) => rect(x, y, 1, 1, color);
    const ellipse = (cx, cy, rx, ry, color, maxY = 19) => {
      for (let y = 1; y <= maxY; y++)
        for (let x = 1; x < 23; x++)
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) pix(x, y, color);
    };
    const roundBox = (x, y, w, h, col, hi, sh) => {
      rect(x + 1, y, w - 2, h, col);
      rect(x, y + 1, w, h - 2, col);
      if (hi) {
        rect(x + 2, y + 1, w - 4, 1, hi);
        pix(x + 1, y + 2, hi);
      }
      if (sh) rect(x + 1, y + h - 2, w - 2, 2, sh);
    };
    const line = (x1, y1, x2, y2, color, width = 1) => {
      const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let i = 0; i <= n; i++)
        rect(
          Math.round(x1 + ((x2 - x1) * i) / (n || 1)),
          Math.round(y1 + ((y2 - y1) * i) / (n || 1)),
          width,
          width,
          color,
        );
    };

    let face = { x: 12, y: 10, color: ink, back: null, blush: '#f4a9b8' };
    let feet = unit.color;
    let autoOutline = true;

    switch (unit.id) {
      case 'doubao':
        autoOutline = false;
        // Brown bob hair + cozy cream face + red knit scarf + brown boots (no hairclip, no blue feet)
        ellipse(12, 10, 9.5, 8.5, ink, 19);
        ellipse(12, 9, 8.5, 7.5, '#5c403c', 18);
        rect(6, 10, 13, 7, '#fff0d6');
        rect(5, 8, 4, 4, '#5c403c');
        rect(8, 6, 8, 4, '#5c403c');
        rect(15, 8, 4, 4, '#5c403c');
        rect(4, 10, 2, 7, '#5c403c');
        rect(19, 10, 2, 7, '#5c403c');
        rect(8, 3, 5, 2, '#785650');
        rect(6, 16, 13, 3, ink);
        rect(6, 17, 13, 2, '#ee5353');
        rect(16, 18, 3, 2, '#c93b42');
        rect(7, 17, 4, 1, '#ff8b8b');
        face = { x: 12, y: 11, color: ink, blush: '#f59ca9' };
        feet = '#5c403c';
        break;

      case 'claude':
        // Plump sunburst blossom with warm apricot-terracotta petals & sunlit center
        for (const [tx, ty] of [
          [12, 2], [17, 3], [20, 6], [21, 10], [20, 14], [17, 17],
          [12, 18], [7, 17], [4, 14], [3, 10], [4, 6], [7, 3],
        ]) {
          line(12, 10, tx, ty, '#eb8a58', 2);
        }
        ellipse(12, 10, 6.2, 6.2, '#f49f6e', 18);
        ellipse(12, 9.5, 4.8, 4.6, '#ffb98c', 17);
        rect(9, 6, 4, 1, '#ffd9bc');
        face = { x: 12, y: 9, color: '#592e24', blush: '#ef7b6c' };
        feet = '#d97648';
        break;

      case 'gpt':
        autoOutline = false;
        // Black & white woven knot without outer white border
        gptRows.forEach((r, y) =>
          [...r].forEach((v, x) => {
            if (v !== '.') pix(x + 4, y + 2, v === 'k' ? '#1f2026' : '#f5f5f0');
          }),
        );
        face = { x: 12, y: 8, color: '#f5f5f0', back: '#1f2026', blush: null };
        feet = '#1f2026';
        break;

      case 'codex':
        // Crisp retro terminal monitor with >_ prompt
        roundBox(3, 3, 18, 15, '#f4f2ec', '#ffffff', '#dad6cc');
        rect(5, 5, 14, 11, '#23222b');
        line(6, 7, 8, 9, '#f7f4e8', 1);
        line(8, 9, 6, 11, '#f7f4e8', 1);
        rect(9, 12, 3, 1, '#b8e8c8');
        face = { x: 14, y: 7, color: '#f7f4e8', small: true, blush: null };
        feet = '#2b2936';
        break;

      case 'deepseek':
        // Chubby pastel-cobalt baby whale with upturned tail fluke & water spout
        ellipse(11, 12, 7.6, 5.8, '#658ef5', 18);
        ellipse(10.5, 10.5, 6.2, 4.2, '#86acff', 16);
        ellipse(10.5, 14.5, 6.2, 2.8, '#e3f3ff', 18);
        rect(17, 9, 3, 4, '#658ef5');
        rect(19, 6, 3, 3, '#7ea3ff');
        rect(20, 5, 2, 2, '#9ec0ff');
        rect(9, 2, 2, 3, '#9be4ff');
        pix(7, 2, '#c7f2ff');
        pix(12, 2, '#c7f2ff');
        face = { x: 10, y: 10, color: ink, blush: '#f4a4be' };
        feet = '#4d73d9';
        break;

      case 'gemini':
        // Iconic curved 4-point Gemini sparkle star with pastel sky-periwinkle-orchid gradient
        for (let y = 2; y <= 18; y++) {
          for (let x = 3; x <= 21; x++) {
            const d =
              Math.pow(Math.abs(x - 12) / 9.2, 0.64) + Math.pow(Math.abs(y - 10.5) / 8.6, 0.64);
            if (d <= 1 || ((x - 12) / 5.1) ** 2 + ((y - 11) / 5.1) ** 2 <= 1) {
              const col =
                x + y < 20 ? '#9cc8ff' : x + y < 25 ? '#a791fa' : '#c592f7';
              pix(x, y, col);
            }
          }
        }
        rect(11, 4, 2, 2, '#d9f0ff');
        pix(18, 3, '#ffeaa6');
        pix(19, 4, '#ffd4eb');
        face = { x: 12, y: 9, color: ink, blush: '#f7a8c8' };
        feet = '#766ad1';
        break;

      case 'gemma':
        // Faceted pastel sky-aqua gem spirit with a cute star-crystal beret crest
        ellipse(12, 12, 6.6, 5.8, '#7ad0e8', 18);
        ellipse(11.5, 11, 5.2, 4.4, '#a6e6f7', 16);
        rect(9, 8, 4, 1, '#e3fbff');
        // Dainty crystal star-beret on top
        rect(8, 4, 8, 3, '#5d92e0');
        rect(10, 3, 4, 2, '#82b4fa');
        rect(11, 4, 2, 2, '#e6fbff');
        pix(17, 5, '#ffe699');
        face = { x: 12, y: 10, color: ink, blush: '#f5a6bc' };
        feet = '#539ec2';
        break;

      case 'grok':
        // Sleek slate-obsidian planet with curved cream orbital ring & clear visor face
        ellipse(12, 11, 7.6, 7.2, '#424656', 18);
        ellipse(11, 9.5, 5.8, 5.2, '#555b6e', 16);
        line(4, 16, 8, 13, '#f5efe6', 2);
        line(15, 7, 20, 3, '#f5efe6', 2);
        pix(8, 6, '#838ba3');
        face = { x: 12, y: 9, color: '#fff8ee', back: '#424656', blush: null };
        feet = '#565c6e';
        break;

      case 'kimi':
        // Crisp midnight-indigo badge with bold white K + pastel periwinkle moon-star
        roundBox(4, 4, 15, 14, '#32364a', '#4b516d', '#242736');
        rect(6, 6, 2, 9, '#f7f5ff');
        line(8, 10, 12, 6, '#f7f5ff', 2);
        line(8, 10, 12, 14, '#f7f5ff', 2);
        rect(17, 2, 3, 5, '#78a9ff');
        rect(16, 3, 5, 3, '#9ec2ff');
        pix(18, 4, '#ffffff');
        face = { x: 14, y: 11, color: '#fff8ee', small: true, blush: null };
        feet = '#3b4159';
        break;

      case 'qwen':
        autoOutline = false;
        // Official Qwen folded 3-band interlock with central triangle, transparent gaps & crisp violet edge
        qwenRows.forEach((row, y) =>
          [...row].forEach((cell, x) => {
            if (cell === '#') pix(x + 2, y + 1, y < 6 ? '#c3affc' : y < 13 ? '#a389f5' : '#856ae0');
          }),
        );
        addCardinalOutline(c, '#43306b');
        face = { x: 11, y: 9, color: '#3b2863', small: true, blush: null };
        feet = '#856ae0';
        break;

      case 'glm':
        // Origami sky-indigo Z-spirit withfaceted bevels & cozy face plate
        roundBox(5, 4, 14, 14, '#6d9ef7', '#9dc2ff', '#4c7be0');
        rect(6, 5, 12, 3, '#a8cbff');
        line(15, 7, 7, 14, '#4674d9', 3);
        rect(6, 14, 12, 3, '#5485eb');
        face = { x: 12, y: 8, color: ink, blush: '#f7a6c1' };
        feet = '#4975d4';
        break;

      case 'minimax':
        // Cute coral-apricot soundwave conch spirit with rhythmic wave crests
        ellipse(12, 12, 7.5, 6.2, '#f79372', 18);
        ellipse(11.5, 11, 6, 4.8, '#ffb396', 17);
        rect(5, 6, 3, 5, '#ffa07d');
        rect(10, 4, 4, 4, '#ffc29e');
        rect(16, 6, 3, 5, '#ffa07d');
        rect(8, 7, 5, 1, '#ffe1cf');
        face = { x: 12, y: 10, color: ink, blush: '#ef768a' };
        feet = '#e07a5c';
        break;

      case 'characterai':
        // Sleek dark-slate chat bubble spirit with [c.ai] forehead crest & warm smile
        roundBox(4, 4, 16, 13, '#3c3d4a', '#57596b', '#2c2d38');
        rect(5, 16, 4, 2, '#3c3d4a');
        // Tiny c.ai pixel badge at top
        rect(8, 6, 2, 3, '#e8e4f0');
        pix(9, 7, '#3c3d4a');
        pix(11, 8, '#a6c8ff');
        rect(13, 6, 2, 3, '#e8e4f0');
        pix(16, 6, '#a6c8ff');
        rect(16, 8, 1, 1, '#e8e4f0');
        face = { x: 12, y: 10, color: '#fff8ee', blush: null };
        feet = '#3c3d4a';
        break;

      case 'replika':
        // Pastel orchid companion egg with soft dome shine & rose heart charm
        ellipse(12, 11, 6.8, 7.6, '#dfb3f2', 18);
        ellipse(11.5, 9.5, 5.2, 5.6, '#eed1fc', 16);
        rect(9, 5, 3, 1, '#fff5ff');
        // Tiny heart on tummy
        rect(10, 15, 2, 2, '#f28bb8');
        rect(13, 15, 2, 2, '#f28bb8');
        rect(11, 16, 3, 2, '#f28bb8');
        face = { x: 12, y: 8, color: ink, blush: '#f495be' };
        feet = '#ba8fd1';
        break;

      case 'talkie':
        // Plump butter-honey speech pod with coral-rose audio waves
        ellipse(11, 11, 7, 6.8, '#fad06b', 18);
        ellipse(10.5, 9.5, 5.5, 5, '#ffe59c', 16);
        rect(5, 16, 3, 2, '#fad06b');
        rect(8, 6, 4, 1, '#fff7d6');
        rect(19, 8, 1, 5, '#f07d9e');
        rect(21, 6, 1, 9, '#f59cb6');
        face = { x: 11, y: 9, color: ink, blush: '#f28ca0' };
        feet = '#dbac46';
        break;

      case 'xiaoice':
        // Cute ice-crystal snow fairy with pastel aqua body, crystal ears & periwinkle scarf
        ellipse(12, 11, 6.8, 6.2, '#9ce8ef', 18);
        ellipse(11.5, 10, 5.4, 4.8, '#caf6fa', 16);
        // Crystal crown/ears
        rect(6, 4, 3, 3, '#b8f2f7');
        rect(15, 4, 3, 3, '#b8f2f7');
        rect(11, 3, 2, 3, '#e3fcff');
        // Cozy periwinkle winter scarf
        rect(6, 15, 12, 3, '#6b9ef0');
        rect(15, 17, 3, 2, '#5585db');
        rect(7, 15, 5, 1, '#99bfff');
        face = { x: 12, y: 9, color: ink, blush: '#f5a3be' };
        feet = '#5c8de0';
        break;

      case 'llama':
        // Fluffy pastel-lavender alpaca with perky ears & infinity fleece curl
        ellipse(12, 13, 7.5, 5.2, '#b59ef5', 18);
        ellipse(15, 9, 4.8, 4.8, '#c8b6fc', 16);
        // Perky alpaca ears
        rect(13, 3, 2, 5, '#c8b6fc');
        rect(17, 3, 2, 5, '#c8b6fc');
        pix(14, 4, '#f5b3c8');
        pix(18, 4, '#f5b3c8');
        // Infinity wool curl on side
        ellipse(8, 13, 3.2, 2.6, '#93b4f7', 17);
        ellipse(8, 13, 1.4, 1.2, '#dcd2ff', 17);
        face = { x: 15, y: 8, color: ink, small: true, blush: '#f5a3c0' };
        feet = '#7d8ce0';
        break;

      case 'mistral':
        // Iconic stepped retro-pixel M wind-spirit in warm macaron sunset stripes
        rect(4, 4, 4, 14, '#ee7758');
        rect(16, 4, 4, 14, '#ee7758');
        rect(8, 7, 8, 9, '#f7a85e');
        rect(10, 10, 4, 7, '#f7c96e');
        rect(4, 4, 4, 4, '#fbe088');
        rect(16, 4, 4, 4, '#fbe088');
        rect(4, 8, 16, 4, '#f7ae62');
        face = { x: 12, y: 9, color: ink, blush: '#e86868' };
        feet = '#cc6852';
        break;

      case 'copilot':
        // Cute pastel ribbon-visor aviation bot with forehead goggles & colorful ear pods
        roundBox(6, 5, 12, 13, '#fff6e8', '#ffffff', '#eadcc9');
        // Forehead pastel goggles
        rect(6, 5, 12, 4, '#6fc8eb');
        rect(7, 6, 4, 2, '#b8f0ff');
        rect(13, 6, 4, 2, '#b8f0ff');
        // Pastel ribbon ear wings
        rect(3, 8, 3, 7, '#67d4c4');
        rect(18, 8, 3, 7, '#b48bf2');
        rect(7, 16, 10, 2, '#f5c26b');
        face = { x: 12, y: 10, color: ink, blush: '#f5a3b8' };
        feet = '#5da8b8';
        break;

      case 'ernie':
        // Cute periwinkle codex tome spirit with cream pages & gold bookmark
        roundBox(5, 4, 14, 14, '#8f82f2', '#b5acff', '#7163d9');
        rect(6, 16, 12, 2, '#fff7ea');
        rect(15, 16, 2, 3, '#f5c76b');
        line(7, 13, 10, 14, '#e6e0ff', 1);
        line(10, 14, 13, 13, '#e6e0ff', 1);
        line(13, 13, 16, 14, '#e6e0ff', 1);
        face = { x: 12, y: 8, color: ink, blush: '#f7a6c4' };
        feet = '#7365d6';
        break;

      case 'hunyuan':
        autoOutline = false;
        // Broad jade yuanbao: shallow top, raised ends, glossy pastel celadon-jade body
        rect(8, 4, 8, 1, ink);
        rect(6, 5, 12, 1, ink);
        rect(5, 6, 14, 3, ink);
        rect(7, 5, 10, 1, '#b6f7e0');
        rect(6, 6, 12, 3, '#88e8c5');
        rect(1, 6, 4, 3, ink);
        rect(19, 6, 4, 3, ink);
        rect(2, 7, 3, 2, '#c5fae7');
        rect(19, 7, 3, 2, '#c5fae7');
        for (let y = 9; y <= 18; y++) {
          const inset = Math.floor((y - 9) / 3),
            x = 1 + inset,
            w = 22 - inset * 2;
          rect(x, y, w, 1, ink);
          rect(x + 1, y, w - 2, 1, y < 14 ? '#7ce5be' : '#4ec298');
        }
        rect(5, 18, 14, 1, ink);
        rect(4, 9, 16, 1, '#bdf7e2');
        rect(4, 10, 3, 2, '#e8fff5');
        face = { x: 12, y: 11, color: '#1f4538', blush: '#f29eb0' };
        feet = '#47b38b';
        break;

      case 'musespark':
        autoOutline = false;
        // Muse: beige plush bean from the user's reference; empty hands, no heart/prop.
        ellipse(12, 10, 8, 9.5, '#9e866c', 18);
        ellipse(12, 9, 7, 8.5, '#e6d4b5', 18);
        ellipse(12, 14.5, 8.5, 5.2, '#9e866c', 18);
        ellipse(12, 14, 7.5, 5, '#dfd0b2', 18);
        rect(7, 2, 10, 2, '#f0e2c6');
        rect(5, 5, 2, 6, '#f0e2c6');
        ellipse(12, 7, 6, 5, '#c9ac86', 14);
        ellipse(12, 7, 5, 4, '#faecc8', 13);
        rect(7, 7, 10, 3, '#faecc8');
        rect(7, 9, 2, 1, '#edaab0');
        rect(16, 9, 2, 1, '#edaab0');
        ellipse(6, 14, 3, 3.8, '#b59c7e', 18);
        ellipse(6, 13, 2, 2.8, '#ead9bc', 17);
        ellipse(18, 14, 3, 3.8, '#b59c7e', 18);
        ellipse(18, 13, 2, 2.8, '#ead9bc', 17);
        rect(9, 18, 6, 1, '#e5d0ad');
        addCardinalOutline(c, '#6b5744');
        face = { x: 12, y: 6, color: '#302820', blush: null };
        feet = '#c9b18e';
        break;

      case 'nai':
        // Pastel violet sketchbook spirit with cream page edge & tilted pixel brush stylus
        roundBox(4, 6, 15, 12, '#b07de8', '#d2b0fa', '#8f5cc9');
        rect(5, 16, 13, 2, '#fcf0d4');
        rect(11, 6, 1, 10, '#8452bd');
        line(16, 9, 20, 2, '#fff9ee', 2);
        pix(21, 2, '#f7a1be');
        face = { x: 10, y: 9, color: ink, blush: '#f7a3c2' };
        feet = '#9362cc';
        break;

      case 'tripo':
        // Isometric 3D mint-celadon crystal cube mascot with sunlit facets
        for (let y = 3; y < 8; y++) rect(12 - (y - 2) * 1.5, y, (y - 2) * 3, 1, '#b6faea');
        rect(5, 8, 7, 10, '#7de6cf');
        rect(12, 8, 7, 10, '#58ccb4');
        line(5, 8, 12, 10, '#e3fff8', 1);
        line(12, 10, 19, 8, '#9ef2de', 1);
        face = { x: 12, y: 11, color: ink, blush: '#f5a1b8' };
        feet = '#4db59f';
        break;

      case 'manus':
        // Crisp outlined cream-gloved helper mascot with soft cuff & friendly expression
        roundBox(5, 9, 14, 8, '#fcf5ea', '#ffffff', '#e6dac8');
        for (let i = 0; i < 4; i++) rect(6 + i * 3, 3 + (i === 0 || i === 3 ? 1 : 0), 2, 7, '#fcf5ea');
        rect(3, 9, 3, 5, '#fcf5ea');
        rect(6, 16, 12, 2, '#6d6482');
        face = { x: 12, y: 10, color: ink, blush: '#f5a6b8' };
        feet = '#534b66';
        break;

      case 'kiro':
        // Cute pastel-lavender ghost mascot with dome shine & wavy scalloped hem
        ellipse(12, 10, 7.2, 6.8, '#c598f2', 17);
        rect(5, 10, 14, 6, '#c598f2');
        ellipse(11, 8.5, 5.2, 4.5, '#dec0fc', 15);
        rect(9, 5, 3, 1, '#f7ecff');
        // Scalloped ghost skirt
        rect(5, 16, 3, 2, '#b080e0');
        rect(10, 16, 4, 2, '#b080e0');
        rect(16, 16, 3, 2, '#b080e0');
        face = { x: 12, y: 9, color: ink, blush: '#f7a1c4' };
        feet = '#9d72cc';
        break;

      case 'jimeng':
        // Dreamy pastel sky-aqua & rose-berry twin-cloud spirit
        ellipse(8.5, 11.5, 5.6, 6.2, '#7cd4f2', 18);
        ellipse(15.5, 11.5, 5.6, 6.2, '#f288cc', 18);
        ellipse(12, 11.5, 4.6, 5.4, '#b89cf7', 17);
        rect(7, 7, 3, 1, '#d9f6ff');
        rect(15, 7, 3, 1, '#ffd9f2');
        pix(12, 5, '#fff8cf');
        face = { x: 12, y: 9, color: '#2b2238', blush: '#ffbad6' };
        feet = '#a572cf';
        break;

      case 'kling':
        // Playful pistachio-lime cinema clapper / lens spirit
        roundBox(4, 4, 16, 14, '#b7eb63', '#dcf9a2', '#95cc45');
        // Clapper top stripes
        rect(5, 5, 3, 2, '#363b34');
        rect(10, 5, 3, 2, '#363b34');
        rect(15, 5, 3, 2, '#363b34');
        // Dark rounded lens window for cute glowing face
        roundBox(7, 8, 10, 8, '#2f3330', null, null);
        face = { x: 12, y: 9, color: '#fffbe8', blush: null };
        feet = '#474d44';
        break;

      case 'ollama':
        // Fluffy cream bunny-alpaca with crisp pixel outline & rosy inner ears
        rect(7, 2, 3, 8, '#f7ebda');
        rect(14, 2, 3, 8, '#f7ebda');
        rect(8, 3, 1, 5, '#f2acb9');
        rect(15, 3, 1, 5, '#f2acb9');
        ellipse(12, 13, 7.4, 5.6, '#f7ebda', 18);
        ellipse(11.5, 11.8, 5.8, 4.2, '#fff7ec', 17);
        face = { x: 12, y: 11, color: ink, blush: '#f4a4b8' };
        feet = '#53495e';
        break;
    }

    if (autoOutline) addCardinalOutline(c, ink);
    return { ...unit, body: c, face, feet };
  }

  return { units: units.map(make) };
})();
