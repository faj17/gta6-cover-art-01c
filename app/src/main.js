// Neon Coast editor — wires the DOM controls to the cover engine.
// Photos are read on this machine only (file picker or bundled samples);
// nothing is uploaded anywhere.
import {
  GRADES,
  LAYOUTS,
  SIZES,
  coverPanels,
  defaultState,
  exportCoverPng,
  renderCover,
  sizeById,
} from './cover.js';
import { applyShotMode } from './shots.js';

const SAMPLES = [
  { src: 'samples/sample-sunset.jpg', name: 'Sunset boulevard' },
  { src: 'samples/sample-neon.jpg', name: 'Neon street' },
  { src: 'samples/sample-pier.jpg', name: 'Pier' },
];

const $ = (id) => document.getElementById(id);
const state = defaultState();
const preview = $('preview');
const previewCtx = preview.getContext('2d');

let drag = null;

/** Size the preview canvas to the current post size, capped for the screen. */
function fitPreview() {
  const size = sizeById(state.size);
  const scale = Math.min(1, 960 / Math.max(size.w, size.h));
  preview.width = Math.round(size.w * scale);
  preview.height = Math.round(size.h * scale);
}

/** Draw the cover plus the selected-panel outline. */
function renderPreview() {
  fitPreview();
  renderCover(previewCtx, preview.width, preview.height, state);
  const rects = coverPanels(state, preview.width, preview.height);
  const rect = rects[state.selected];
  if (rect) {
    previewCtx.save();
    previewCtx.strokeStyle = '#00e5ff';
    previewCtx.lineWidth = 3;
    previewCtx.setLineDash([10, 6]);
    previewCtx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    previewCtx.setLineDash([]);
    previewCtx.fillStyle = '#00e5ff';
    previewCtx.fillRect(rect.x + 2, rect.y + 2, 34, 26);
    previewCtx.fillStyle = '#12081f';
    previewCtx.font = '900 16px "Arial Black", Impact, sans-serif';
    previewCtx.textAlign = 'center';
    previewCtx.textBaseline = 'middle';
    previewCtx.fillText(String(state.selected + 1), rect.x + 19, rect.y + 16);
    previewCtx.restore();
  }
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${coverPanels(state, 1, 1).length}`;
  $('zoomRange').value = String(panel().zoom);
  $('zoomVal').textContent = `${panel().zoom.toFixed(2)}x`;
}

function panel() {
  return state.panels[state.selected];
}

function ensurePanels() {
  const n = coverPanels(state, 1, 1).length;
  while (state.panels.length < n) state.panels.push({ photo: -1, zoom: 1, ox: 0, oy: 0 });
}

/** Which panel (if any) sits under preview-canvas point (x, y). */
function hitPanel(x, y) {
  const rects = coverPanels(state, preview.width, preview.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function canvasPoint(event) {
  const box = preview.getBoundingClientRect();
  return {
    x: (event.clientX - box.left) * (preview.width / box.width),
    y: (event.clientY - box.top) * (preview.height / box.height),
  };
}

function bindPreview() {
  preview.addEventListener('pointerdown', (event) => {
    const p = canvasPoint(event);
    const hit = hitPanel(p.x, p.y);
    if (hit < 0) return;
    state.selected = hit;
    drag = { x: p.x, y: p.y };
    preview.setPointerCapture(event.pointerId);
    renderPreview();
  });
  preview.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const p = canvasPoint(event);
    const rect = coverPanels(state, preview.width, preview.height)[state.selected];
    if (!rect) return;
    panel().ox += (p.x - drag.x) / rect.w;
    panel().oy += (p.y - drag.y) / rect.h;
    panel().ox = Math.max(-1, Math.min(1, panel().ox));
    panel().oy = Math.max(-1, Math.min(1, panel().oy));
    drag = { x: p.x, y: p.y };
    renderPreview();
  });
  const endDrag = () => { drag = null; };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);
  preview.addEventListener('wheel', (event) => {
    event.preventDefault();
    const p = canvasPoint(event);
    const hit = hitPanel(p.x, p.y);
    if (hit >= 0) state.selected = hit;
    panel().zoom = Math.max(1, Math.min(4, panel().zoom * Math.exp(-event.deltaY * 0.0012)));
    renderPreview();
  }, { passive: false });
}

/** Load one image file (URL or File object) into state.photos. */
function loadPhoto(source, name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      state.photos.push({ img, name });
      resolve(state.photos.length - 1);
    };
    img.onerror = () => reject(new Error(`could not load ${name}`));
    img.src = source instanceof File ? URL.createObjectURL(source) : source;
  });
}

async function loadSamples() {
  for (const s of SAMPLES) {
    try {
      await loadPhoto(s.src, s.name);
    } catch (err) {
      console.warn(err.message);
    }
  }
  // One photo everywhere, so the app works out of the box.
  if (state.photos.length > 0) {
    state.panels[0].photo = 0;
    state.panels[1].photo = state.photos.length > 1 ? 1 : 0;
    state.panels[2].photo = state.photos.length > 2 ? 2 : 0;
    state.panels[3].photo = 0;
  }
  buildPhotoStrip();
  buildSampleRow();
  renderPreview();
}

function buildPhotoStrip() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = `Put “${photo.name}” in the selected panel`;
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    button.appendChild(img);
    button.addEventListener('click', () => {
      panel().photo = i;
      renderPreview();
    });
    strip.appendChild(button);
  });
  $('photoCount').textContent = `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded`;
}

function buildSampleRow() {
  const row = $('sampleRow');
  row.innerHTML = '';
  state.photos.slice(0, SAMPLES.length).forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sample-btn';
    const img = document.createElement('img');
    img.src = photo.img.src;
    img.alt = photo.name;
    const span = document.createElement('span');
    span.textContent = photo.name;
    button.append(img, span);
    button.addEventListener('click', () => {
      panel().photo = i;
      renderPreview();
    });
    row.appendChild(button);
  });
}

function buildOptionButtons() {
  const layoutRow = $('layoutRow');
  LAYOUTS.forEach((layout) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'opt-btn';
    button.dataset.layout = layout.id;
    button.textContent = layout.name;
    button.addEventListener('click', () => {
      state.layout = layout.id;
      state.selected = 0;
      ensurePanels();
      syncOptionButtons();
      renderPreview();
    });
    layoutRow.appendChild(button);
  });
  const gradeRow = $('gradeRow');
  GRADES.forEach((grade) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'opt-btn';
    button.dataset.grade = grade.id;
    button.title = grade.hint;
    button.textContent = grade.name;
    button.addEventListener('click', () => {
      state.grade = grade.id;
      syncOptionButtons();
      renderPreview();
    });
    gradeRow.appendChild(button);
  });
  const sizeRow = $('sizeRow');
  SIZES.forEach((size) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'opt-btn';
    button.dataset.size = size.id;
    button.textContent = size.label;
    button.addEventListener('click', () => {
      state.size = size.id;
      syncOptionButtons();
      renderPreview();
    });
    sizeRow.appendChild(button);
  });
}

function syncOptionButtons() {
  document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('[data-size]').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function exportOne(size, silent) {
  const blob = await exportCoverPng(state, size);
  if (!silent) {
    downloadBlob(blob, `neon-coast-${size.id}-${size.w}x${size.h}.png`);
    $('exportStatus').textContent = `Exported ${size.label} PNG — ${(blob.size / 1024).toFixed(0)} KB. Saved to your downloads.`;
  }
  return blob;
}

function bindControls() {
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; renderPreview(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; renderPreview(); });
  $('zoomRange').addEventListener('input', (e) => {
    panel().zoom = Number(e.target.value);
    renderPreview();
  });
  $('fillAllBtn').addEventListener('click', () => {
    const photo = panel().photo;
    state.panels.forEach((p) => { p.photo = photo; });
    renderPreview();
  });
  $('resetCropBtn').addEventListener('click', () => {
    panel().zoom = 1;
    panel().ox = 0;
    panel().oy = 0;
    renderPreview();
  });
  $('addPhotosBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    for (const file of files) {
      try {
        const idx = await loadPhoto(file, file.name);
        const empty = state.panels.findIndex((p) => p.photo < 0);
        if (empty >= 0) state.panels[empty].photo = idx;
        else panel().photo = idx;
      } catch (err) {
        console.warn(err.message);
      }
    }
    buildPhotoStrip();
    renderPreview();
    e.target.value = '';
  });
  $('exportBtn').addEventListener('click', async () => {
    $('exportStatus').textContent = 'Exporting…';
    try {
      await exportOne(sizeById(state.size), false);
    } catch (err) {
      $('exportStatus').textContent = `Export failed: ${err.message}`;
    }
  });
  $('exportAllBtn').addEventListener('click', async () => {
    $('exportStatus').textContent = 'Exporting all three sizes…';
    try {
      for (const size of SIZES) await exportOne(size, true);
      $('exportStatus').textContent = 'Exported all three sizes — check your downloads.';
    } catch (err) {
      $('exportStatus').textContent = `Export failed: ${err.message}`;
    }
  });
  bindPreview();
}

buildOptionButtons();
bindControls();
syncOptionButtons();
$('titleInput').value = state.title;
$('subtitleInput').value = state.subtitle;
await loadSamples();
renderPreview();

// Deterministic shot mode for screenshots (?shot=cover|editor|export).
await applyShotMode(state, { renderPreview, fitPreview, syncOptionButtons, buildPhotoStrip, preview });
