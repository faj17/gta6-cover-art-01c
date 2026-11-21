// Neon Coast cover engine — pure canvas rendering, no dependencies.
// A cover is a set of photo panels in a layout, a colour grade, and bold
// caption lettering drawn on top. renderCover draws the same art at any
// size, so the on-screen preview and the exported PNG are one drawing.

export const SIZES = [
  { id: 'square', label: '1080 x 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 x 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 x 1080', w: 1920, h: 1080 },
];

export const GRADES = [
  { id: 'sunset', name: 'Sunset', hint: 'Warm orange-pink Vice City dusk' },
  { id: 'neon', name: 'Neon Night', hint: 'Cool blue with pink neon glow' },
  { id: 'teal', name: 'Palm Teal', hint: 'Teal shadows, warm highlights' },
  { id: 'heat', name: 'Mono Heat', hint: 'Black-and-white with a hot duotone' },
];

// Each layout is a function of cover width/height returning its panels and
// its title zone, all in pixels. Panels are { x, y, w, h } rects.
export const LAYOUTS = [
  {
    id: 'hero-strip',
    name: 'Hero + Strip',
    panels(w, h) {
      const g = Math.round(w * 0.012);
      const heroH = Math.round(h * 0.58);
      const stripY = heroH + g;
      const stripH = h - stripY;
      const sw = Math.round((w - g * 2) / 3);
      return [
        { x: 0, y: 0, w, h: heroH },
        { x: 0, y: stripY, w: sw, h: stripH },
        { x: sw + g, y: stripY, w: sw, h: stripH },
        { x: (sw + g) * 2, y: stripY, w: w - (sw + g) * 2, h: stripH },
      ];
    },
    titleZone(w, h) {
      return { x: 0, y: Math.round(h * 0.40), w, h: Math.round(h * 0.20), align: 'left' };
    },
  },
  {
    id: 'quad',
    name: 'Four Grid',
    panels(w, h) {
      const g = Math.round(w * 0.012);
      const cw = Math.round((w - g) / 2);
      const ch = Math.round((h - g) / 2);
      return [
        { x: 0, y: 0, w: cw, h: ch },
        { x: cw + g, y: 0, w: w - cw - g, h: ch },
        { x: 0, y: ch + g, w: cw, h: h - ch - g },
        { x: cw + g, y: ch + g, w: w - cw - g, h: h - ch - g },
      ];
    },
    titleZone(w, h) {
      return { x: 0, y: Math.round(h * 0.66), w, h: Math.round(h * 0.22), align: 'center' };
    },
  },
  {
    id: 'trio',
    name: 'Tall Trio',
    panels(w, h) {
      const g = Math.round(w * 0.012);
      const leftW = Math.round(w * 0.54);
      const rightX = leftW + g;
      const rightW = w - rightX;
      const topH = Math.round((h - g) / 2);
      return [
        { x: 0, y: 0, w: leftW, h },
        { x: rightX, y: 0, w: rightW, h: topH },
        { x: rightX, y: topH + g, w: rightW, h: h - topH - g },
      ];
    },
    titleZone(w, h) {
      return { x: 0, y: Math.round(h * 0.72), w: Math.round(w * 0.54), h: Math.round(h * 0.20), align: 'left' };
    },
  },
  {
    id: 'full-bleed',
    name: 'Full Bleed',
    panels(w, h) {
      return [{ x: 0, y: 0, w, h }];
    },
    titleZone(w, h) {
      return { x: 0, y: Math.round(h * 0.68), w, h: Math.round(h * 0.26), align: 'center' };
    },
  },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

export function sizeById(id) {
  return SIZES.find((s) => s.id === id) ?? SIZES[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/** A fresh cover state: no photos yet, first layout, sunset grade. */
export function defaultState() {
  return {
    layout: 'hero-strip',
    grade: 'sunset',
    size: 'wide',
    title: 'NEON COAST',
    subtitle: 'A NIGHT TO REMEMBER',
    photos: [], // { img, name }
    panels: [
      { photo: -1, zoom: 1, ox: 0, oy: 0 },
      { photo: -1, zoom: 1, ox: 0, oy: 0 },
      { photo: -1, zoom: 1, ox: 0, oy: 0 },
      { photo: -1, zoom: 1, ox: 0, oy: 0 },
    ],
    selected: 0,
    grain: true,
    frame: true,
  };
}

/** Panels of the state's layout at cover size, in pixels. */
export function coverPanels(state, w, h) {
  return layoutById(state.layout).panels(w, h);
}

/** The title zone of the state's layout at cover size, in pixels. */
export function coverTitleZone(state, w, h) {
  return layoutById(state.layout).titleZone(w, h);
}

// ------------------------------------------------------------------ photos

function drawPhotoInto(ctx, img, rect, panel, grade) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(rect.w / iw, rect.h / ih) * (panel.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (panel.ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (panel.oy || 0) * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = photoFilter(grade);
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.filter = 'none';
  gradeWash(ctx, rect, grade);
  ctx.restore();
}

/** The per-grade filter applied while the photo itself is drawn. */
function photoFilter(grade) {
  switch (grade) {
    case 'sunset': return 'saturate(1.28) contrast(1.06) brightness(1.02)';
    case 'neon': return 'saturate(1.32) contrast(1.12) brightness(0.94)';
    case 'teal': return 'saturate(1.16) contrast(1.05) hue-rotate(-8deg)';
    case 'heat': return 'grayscale(1) contrast(1.18) brightness(1.06)';
    default: return 'none';
  }
}

/** The per-grade colour wash laid over a panel after its photo. */
function gradeWash(ctx, rect, grade) {
  let wash;
  switch (grade) {
    case 'sunset':
      wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      wash.addColorStop(0, 'rgba(255,140,60,0.05)');
      wash.addColorStop(1, 'rgba(255,45,120,0.30)');
      break;
    case 'neon':
      wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      wash.addColorStop(0, 'rgba(0,229,255,0.12)');
      wash.addColorStop(1, 'rgba(255,45,149,0.32)');
      break;
    case 'teal':
      wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      wash.addColorStop(0, 'rgba(0,180,170,0.14)');
      wash.addColorStop(1, 'rgba(255,170,80,0.14)');
      break;
    case 'heat': {
      wash = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
      wash.addColorStop(0, 'rgba(40,10,60,0.45)');
      wash.addColorStop(1, 'rgba(255,110,40,0.42)');
      break;
    }
    default:
      return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawEmptyPanel(ctx, rect, index) {
  const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  g.addColorStop(0, '#2a1245');
  g.addColorStop(1, '#12081f');
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1, rect.w * 0.004);
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.h);
  ctx.lineTo(rect.x + rect.w, rect.y);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `900 ${Math.round(rect.h * 0.22)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index + 1), rect.x + rect.w / 2, rect.y + rect.h / 2);
}

// ------------------------------------------------------------------ lettering

const TITLE_FACE = '"Arial Black", "Franklin Gothic Heavy", Impact, sans-serif';

/** Split a title into at most two lines that fit maxWidth at fontPx. */
function wrapTitle(ctx, text, maxWidth, fontPx) {
  ctx.font = `900 ${fontPx}px ${TITLE_FACE}`;
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
    if (lines.length === 1 && line && ctx.measureText(line).width > maxWidth && lines.length + 1 >= 2) break;
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function drawTitle(ctx, state, zone) {
  const pad = zone.w * 0.045;
  const maxW = zone.w - pad * 2;
  const title = (state.title || '').trim().toUpperCase() || 'NEON COAST';
  let px = Math.round(zone.h * 0.46);
  let lines = wrapTitle(ctx, title, maxW, px);
  while (lines.length > 1 && px > 12) {
    px = Math.round(px * 0.92);
    lines = wrapTitle(ctx, title, maxW, px);
  }
  while (lines.length === 1 && px > 12 && ctx.measureText(lines[0]).width > maxW) {
    px = Math.round(px * 0.94);
    ctx.font = `900 ${px}px ${TITLE_FACE}`;
  }
  const lineH = px * 1.02;
  const blockH = lines.length * lineH;
  let top = zone.y + (zone.h - blockH) / 2;
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  if (subtitle) top -= px * 0.16;

  // Scrim so lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
  scrim.addColorStop(0, 'rgba(10,4,24,0)');
  scrim.addColorStop(0.45, 'rgba(10,4,24,0.55)');
  scrim.addColorStop(1, 'rgba(10,4,24,0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  const align = zone.align ?? 'left';
  const cx = align === 'center' ? zone.x + zone.w / 2 : zone.x + pad;
  ctx.textAlign = align === 'center' ? 'center' : 'left';
  ctx.textBaseline = 'alphabetic';
  const fill = ctx.createLinearGradient(0, top, 0, top + blockH);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(0.55, '#ffd76a');
  fill.addColorStop(1, '#ff5e8a');
  lines.forEach((line, i) => {
    const y = top + px * 0.86 + i * lineH;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(0.86, 1);
    ctx.font = `900 ${px}px ${TITLE_FACE}`;
    ctx.shadowColor = 'rgba(255,45,149,0.55)';
    ctx.shadowBlur = px * 0.10;
    ctx.shadowOffsetY = px * 0.03;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160a2e';
    ctx.lineWidth = px * 0.09;
    ctx.strokeText(line, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });

  if (subtitle) {
    const subPx = Math.max(10, Math.round(px * 0.24));
    ctx.save();
    ctx.font = `italic 700 ${subPx}px Georgia, "Times New Roman", serif`;
    try { ctx.letterSpacing = `${Math.round(subPx * 0.28)}px`; } catch { /* older canvas */ }
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = subPx * 0.4;
    const sy = top + blockH + subPx * 1.15;
    ctx.fillText(subtitle, cx, sy);
    // Neon rule under the subtitle.
    const ruleW = Math.min(maxW, ctx.measureText(subtitle).width + subPx * 0.28 * subtitle.length);
    const rx = align === 'center' ? cx - ruleW / 2 : cx;
    const rule = ctx.createLinearGradient(rx, 0, rx + ruleW, 0);
    rule.addColorStop(0, '#00e5ff');
    rule.addColorStop(1, '#ff2d95');
    ctx.shadowColor = 'rgba(255,45,149,0.8)';
    ctx.shadowBlur = subPx * 0.5;
    ctx.fillStyle = rule;
    ctx.fillRect(rx, sy + subPx * 0.55, ruleW, Math.max(2, subPx * 0.14));
    ctx.restore();
  }
}

// ------------------------------------------------------------------ finish

let noisePattern = null;
function grainPattern(ctx) {
  if (noisePattern) return noisePattern;
  const n = document.createElement('canvas');
  n.width = 128;
  n.height = 128;
  const nctx = n.getContext('2d');
  const img = nctx.createImageData(128, 128);
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rnd() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  noisePattern = ctx.createPattern(n, 'repeat');
  return noisePattern;
}

/** Draw the whole cover for `state` onto ctx at W x H pixels. */
export function renderCover(ctx, W, H, state) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#12081f';
  ctx.fillRect(0, 0, W, H);
  const panels = coverPanels(state, W, H);
  panels.forEach((rect, i) => {
    const panel = state.panels[i] ?? { photo: -1, zoom: 1, ox: 0, oy: 0 };
    const photo = panel.photo >= 0 ? state.photos[panel.photo] : null;
    if (photo && photo.img) drawPhotoInto(ctx, photo.img, rect, panel, state.grade);
    else drawEmptyPanel(ctx, rect, i);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, W * 0.002);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  });
  drawTitle(ctx, state, coverTitleZone(state, W, H));
  if (state.frame) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, W * 0.006);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    ctx.strokeStyle = 'rgba(0,229,255,0.9)';
    ctx.lineWidth = Math.max(1, W * 0.0015);
    const inset = W * 0.012;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  }
  // Vignette.
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = grainPattern(ctx);
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.restore();
}

/** Render the cover for `state` at a post size into a fresh canvas. */
export function coverCanvas(state, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas.getContext('2d'), size.w, size.h, state);
  return canvas;
}

/** The cover for `state` at a post size, as a PNG blob. */
export function exportCoverPng(state, size) {
  return new Promise((resolve, reject) => {
    coverCanvas(state, size).toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}
