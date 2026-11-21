// Neon Coast shot mode — deterministic scenes for screenshots.
//   ?shot=cover&size=wide&layout=hero-strip&grade=sunset&title=NEON%20COAST
//       full-frame cover only, no editor chrome; the app's own drawing.
//   ?shot=editor   the editor with the sample photos loaded and a caption set.
//   ?shot=export&size=portrait
//       renders the export PNG at full size and reports it in the DOM
//       (a <pre id="shot-export">) so a headless run can verify the export.
import { coverCanvas, renderCover, sizeById } from './cover.js';

function readParams() {
  const q = new URLSearchParams(location.search);
  return {
    shot: q.get('shot') || '',
    size: q.get('size') || '',
    layout: q.get('layout') || '',
    grade: q.get('grade') || '',
    title: q.get('title') || '',
    subtitle: q.get('subtitle') || '',
    caption: q.get('caption') || '',
    photos: q.get('photos') || '',
  };
}

function applyStateParams(state, params) {
  if (params.size) state.size = params.size;
  if (params.layout) state.layout = params.layout;
  if (params.grade) state.grade = params.grade;
  if (params.title) state.title = params.title;
  else if (params.caption) state.title = params.caption;
  if (params.subtitle) state.subtitle = params.subtitle;
  const picked = params.photos
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 0 && n < state.photos.length);
  if (picked.length > 0) {
    picked.forEach((photo, i) => {
      if (state.panels[i]) state.panels[i].photo = photo;
    });
  }
}

/** The shot size: the chosen post size capped to a 1280 px long side. */
function shotDimensions(state) {
  const size = sizeById(state.size);
  const scale = Math.min(1, 1280 / Math.max(size.w, size.h));
  return { w: Math.round(size.w * scale), h: Math.round(size.h * scale) };
}

async function shotCover(state, ui) {
  document.body.classList.add('shot-cover');
  const { w, h } = shotDimensions(state);
  ui.preview.width = w;
  ui.preview.height = h;
  ui.preview.style.width = '100vw';
  ui.preview.style.height = '100vh';
  renderCover(ui.preview.getContext('2d'), w, h, state);
  document.title = 'shot-ready';
}

async function shotEditor(state, ui) {
  ui.syncOptionButtons();
  ui.renderPreview();
  document.title = 'shot-ready';
}

async function shotExport(state) {
  const size = sizeById(state.size);
  const canvas = coverCanvas(state, size);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png');
  });
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('could not read PNG'));
    reader.readAsDataURL(blob);
  });
  const pre = document.createElement('pre');
  pre.id = 'shot-export';
  pre.textContent = `PNG ${blob.size} bytes, data URL ${dataUrl.length} chars, prefix ${dataUrl.slice(0, 30)}`;
  document.body.appendChild(pre);
  document.title = 'shot-export-ready';
}

/**
 * Run shot mode when the page carries ?shot=.... Returns true when a shot
 * scene was applied; the editor runs normally otherwise.
 */
export async function applyShotMode(state, ui) {
  const params = readParams();
  if (!params.shot) return false;
  applyStateParams(state, params);
  if (params.shot === 'cover') await shotCover(state, ui);
  else if (params.shot === 'editor') await shotEditor(state, ui);
  else if (params.shot === 'export') await shotExport(state);
  else {
    ui.renderPreview();
    document.title = 'shot-ready';
  }
  return true;
}
