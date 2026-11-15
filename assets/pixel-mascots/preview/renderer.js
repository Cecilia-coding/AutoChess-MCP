'use strict';
// Stateless canvas renderer. Load mascots.js first; no DOM controls or combat timers required.
window.PixelMascots = (() => {
  const byId = new Map(Mascots.units.map((u) => [u.id, u]));
  const bootInk = '#282233';
  const emotion = (hp, t = 0, shock = 0) =>
    hp <= 0 ? 'dead' : t < shock ? 'shock' : hp <= 20 ? 'cry' : hp <= 50 ? 'serious' : 'happy';

  function rect(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function text(g, str, x, y, color, size = 10) {
    g.fillStyle = color;
    g.font = `${size}px monospace`;
    g.textAlign = 'center';
    g.fillText(str, Math.round(x), Math.round(y));
  }
  function gait(t) {
    const frame = Math.floor(t / 115) % 4;
    return [
      [-2, 2, -1, 0],
      [0, 0, 0, -1],
      [2, -2, 0, -1],
      [0, 0, -1, 0],
    ][frame];
  }

  function drawBoot(g, x, y, fill, mono) {
    const rim = mono ? '#18191c' : bootInk;
    rect(g, x - 1, y, 4, 4, rim);
    rect(g, x - 1, y + 2, 5, 3, rim);
    rect(g, x, y, 2, 3, fill);
    rect(g, x, y + 2, 3, 2, fill);
  }

  function drawFace(g, u, mood, t) {
    const f = u.face,
      x = f.x,
      y = f.y,
      c = f.color;
    if (f.back) rect(g, x - 4, y - 1, 9, 7, f.back);
    const d = f.small ? 2 : 3;
    if (mood === 'dead') {
      for (const a of [-d, d]) {
        rect(g, x + a - 1, y, 1, 1, c);
        rect(g, x + a + 1, y, 1, 1, c);
        rect(g, x + a, y + 1, 1, 1, c);
        rect(g, x + a - 1, y + 2, 1, 1, c);
        rect(g, x + a + 1, y + 2, 1, 1, c);
      }
      rect(g, x - 1, y + 4, 3, 1, c);
      return;
    }
    if (f.blush && (mood === 'happy' || mood === 'cry')) {
      rect(g, x - d - 2, y + 2, 2, 1, f.blush);
      rect(g, x + d + 1, y + 2, 2, 1, f.blush);
    }
    if (mood === 'happy') {
      for (const a of [-d, d]) {
        rect(g, x + a - 1, y + 1, 1, 1, c);
        rect(g, x + a, y, 1, 1, c);
        rect(g, x + a + 1, y + 1, 1, 1, c);
      }
      rect(g, x - 2, y + 3, 1, 1, c);
      rect(g, x + 2, y + 3, 1, 1, c);
      rect(g, x - 1, y + 4, 3, 1, c);
    } else if (mood === 'shock') {
      for (const a of [-d, d]) {
        rect(g, x + a - 1, y - 2, 3, 4, '#25232d');
        rect(g, x + a, y - 1, 1, 2, '#ffffff');
      }
      rect(g, x - 1, y + 3, 3, 3, '#25232d');
      rect(g, x, y + 4, 1, 1, '#fff1d4');
    } else if (mood === 'cry') {
      for (const a of [-d, d]) {
        rect(g, x + a - 1, y, 3, 1, c);
        rect(g, x + a, y + 1, 1, 2, '#86d2ed');
        rect(g, x + a, y + 3 + (Math.floor(t / 180) % 3), 1, 2, '#86d2ed');
      }
      rect(g, x - 1, y + 3, 3, 1, c);
      rect(g, x - 2, y + 4, 1, 1, c);
      rect(g, x + 2, y + 4, 1, 1, c);
    } else {
      rect(g, x - d, y, 1, 2, c);
      rect(g, x + d, y, 1, 2, c);
      rect(g, x - 2, y + 4, 5, 1, c);
    }
  }

  function drawActor(
    g,
    u,
    x,
    y,
    scale,
    t,
    hp,
    action = 'idle',
    age = 9999,
    shock = 0,
    hitAge = 9999,
    shockAge = 9999,
    reduced = false,
  ) {
    const mood = emotion(hp, t, shock);
    const walk = action === 'walk' && hp > 0;
    const walkStep = Math.floor(t / 115) % 4;
    const idleStep = Math.floor(t / 225) % 4;
    const feet = walk ? gait(t) : [0, 0, 0, 0];
    let bob = walk
      ? [1.2, 0, 1.2, 0][walkStep]
      : !reduced && hp > 0
        ? [0, 1, 0, -0.6][idleStep]
        : 0;
    let dx = 0,
      dy = 0,
      lean = walk && !reduced ? [0.05, 0, -0.05, 0][walkStep] : 0,
      sx = !walk && !reduced && hp > 0 ? [1, 0.97, 1, 1.03][idleStep] : 1,
      sy = !walk && !reduced && hp > 0 ? [1, 1.04, 1, 0.96][idleStep] : 1;

    if (age >= 0 && age < 850 && hp > 0) {
      if (age < 220) {
        const q = age / 220;
        dx = -Math.round(q * 2.5);
        lean = -0.1 * q;
        sx = 1 + 0.06 * q;
        sy = 1 - 0.08 * q;
      } else if (age < 440) {
        const q = Math.sin(((age - 220) / 220) * (Math.PI / 2));
        dx = Math.round(6 * q);
        dy = -Math.round(2 * Math.sin(((age - 220) / 220) * Math.PI));
        lean = 0.14 * q;
        sx = 0.96;
        sy = 1.05;
      } else {
        const q = 1 - (age - 440) / 410;
        dx = Math.round(6 * q * q);
        lean = 0.08 * q;
        sx = 1;
        sy = 1;
      }
    }
    if (mood === 'shock' && !reduced) {
      if (shockAge < 220) dx += Math.round(Math.sin(shockAge / 22) * 1.8 * (1 - shockAge / 220));
      if (shockAge < 300) dy -= Math.round(Math.sin((shockAge / 300) * Math.PI) * 2);
    }
    if (hitAge >= 0 && hitAge < 240 && !reduced) {
      dx -= Math.round(Math.sin((hitAge / 240) * Math.PI) * 3);
      lean = -0.12;
      sx = 1.05;
      sy = 0.94;
    }

    const mono = u.id === 'gpt' || u.id === 'codex';
    g.save();
    g.translate(Math.round(x + dx * scale), Math.round(y + dy * scale));
    g.scale(scale, scale);
    g.imageSmoothingEnabled = false;
    if (hp <= 0) {
      g.translate(11, 20);
      g.rotate(Math.PI / 2);
      g.translate(-11, -20);
    }
    drawBoot(g, 7 + feet[0], 19 + feet[2], u.feet, mono);
    drawBoot(g, 15 + feet[1], 19 + feet[3], u.feet, mono);
    g.translate(12, 19 - bob);
    g.rotate(reduced ? 0 : lean);
    g.scale(reduced ? 1 : sx, reduced ? 1 : sy);
    g.translate(-12, -19);
    g.drawImage(u.body, 0, 0);
    drawFace(g, u, mood, t);
    if (hitAge >= 0 && hitAge < 100) {
      g.globalAlpha = 0.45;
      g.globalCompositeOperation = 'source-atop';
      rect(g, 1, 0, 22, 20, '#ffffff');
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    g.restore();
    return { mood, feet, dx };
  }

  function shockEffect(ctx, x, y, age, life, reduced) {
    const fade = Math.min(1, (life - age) / 180),
      cx = x + 48,
      cy = y + 40;
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    if (!reduced) {
      const length = age < 220 ? 16 : 9;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.1,
          r = 57 + (age < 160 ? Math.floor(age / 40) : 4);
        for (let n = 0; n < length; n += 2) {
          const px = cx + Math.cos(a) * (r + n),
            py = cy + Math.sin(a) * (r + n) * 0.64;
          rect(ctx, px + 1, py + 1, 2, 2, '#2d2438');
          rect(ctx, px, py, 2, 2, '#fff0b5');
        }
      }
    }
    const markX = x + 101,
      markY = y + 2 - (reduced ? 0 : Math.round(Math.max(0, 1 - age / 180) * 7));
    rect(ctx, markX - 2, markY - 2, 11, 23, '#2d2438');
    rect(ctx, markX, markY, 6, 13, '#ffe29e');
    rect(ctx, markX, markY + 17, 6, 4, '#ffe29e');
    const dropY = y + 30 + (reduced ? 0 : Math.min(14, Math.floor(age / 45)));
    rect(ctx, x + 87, dropY, 3, 3, '#d4f5fc');
    rect(ctx, x + 85, dropY + 3, 6, 7, '#8ad2eb');
    ctx.restore();
  }

  function draw(g, id, options = {}) {
    const u = byId.get(id.replace(/^ai-/, ''));
    if (!u) throw new Error('Unknown mascot: ' + id);
    const {
      x = 0,
      y = 0,
      scale = 1,
      timeMs = 0,
      hp = 100,
      action = 'idle',
      attackAgeMs = 9999,
      hitAgeMs = 9999,
      shockAgeMs = 9999,
      shockDurationMs = 650,
      reducedMotion = false,
      effects = true,
      shield = false,
    } = options;
    const shocked = shockAgeMs >= 0 && shockAgeMs < shockDurationMs && hp > 0;
    const result = drawActor(
      g,
      u,
      x,
      y,
      scale,
      timeMs,
      hp,
      action,
      attackAgeMs,
      shocked ? timeMs + 1 : 0,
      hitAgeMs,
      shockAgeMs,
      reducedMotion,
    );
    if (effects && shocked) {
      g.save();
      g.translate(x, y);
      g.scale(scale / 4, scale / 4);
      shockEffect(g, 0, 0, shockAgeMs, shockDurationMs, reducedMotion);
      g.restore();
    }
    if (shield && hp > 0) {
      g.save();
      g.strokeStyle = '#a8dfea';
      g.lineWidth = Math.max(1, scale / 2);
      g.beginPath();
      g.arc(x + scale * 12, y + scale * 11, scale * 13, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    return result;
  }

  return { draw, drawActor, shockEffect, drawFace, gait, emotion, rect, text };
})();
