const el = {
  panel: document.getElementById('panel'),
  toggle: document.getElementById('togglePanel'),

  words: document.getElementById('words'),
  fontSize: document.getElementById('fontSize'),
  fontSizeOut: document.getElementById('fontSizeOut'),

  startPx: document.getElementById('startPx'),
  startPxOut: document.getElementById('startPxOut'),

  radius: document.getElementById('radius'),
  radiusOut: document.getElementById('radiusOut'),

  angle: document.getElementById('angle'),
  angleOut: document.getElementById('angleOut'),

  letterSpacing: document.getElementById('letterSpacing'),
  lsOut: document.getElementById('lsOut'),

  rotX: document.getElementById('rotX'),
  rotXOut: document.getElementById('rotXOut'),
  rotY: document.getElementById('rotY'),
  rotYOut: document.getElementById('rotYOut'),
  rotZ: document.getElementById('rotZ'),
  rotZOut: document.getElementById('rotZOut'),

  stage: document.getElementById('stage'),
  svg: document.getElementById('radialSvg'),
  defs: document.getElementById('defs'),
  labels: document.getElementById('labels'),

  downloadSvgBtn: document.getElementById('downloadSvg'),
  downloadSvgOutlinesBtn: document.getElementById('downloadSvgOutlines'),
  downloadPngExactBtn: document.getElementById('downloadPngExact'),
  reset: document.getElementById('reset'),

  // Font dropzone
  fontDrop: document.getElementById('fontDrop'),
  fontDropLabel: document.getElementById('fontDropLabel'),
  fontFile: document.getElementById('fontFile'),
};

el.toggle.addEventListener('click', () => el.panel.classList.toggle('hidden'));

// Safari needs this for SVG overflow
el.svg.setAttribute('overflow', 'visible');

// ---------- Custom font state ----------
const fontState = {
  family: null,
  mime: null,
  dataB64: null,
  buffer: null,
  font: null
};
let fontCounter = 0;

function extToMime(name='') {
  const ext = name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'otf':  return 'font/otf';
    case 'ttf':  return 'font/ttf';
    case 'woff': return 'font/woff';
    case 'woff2':return 'font/woff2';
    default:     return 'application/octet-stream';
  }
}
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
async function loadCustomFont(file) {
  if (!file) return;
  el.fontDropLabel.textContent = `Loading ${file.name}…`;

  const mime = extToMime(file.name);
  const buf = await file.arrayBuffer();
  const b64 = arrayBufferToBase64(buf);

  const family = `UserFont_${++fontCounter}`;
  const ff = new FontFace(family, `url(data:${mime};base64,${b64})`);
  await ff.load();
  document.fonts.add(ff);

  let parsed = null;
  try { if (window.opentype) parsed = opentype.parse(buf); }
  catch (e) { console.warn('opentype parse failed:', e); }

  fontState.family = family;
  fontState.mime = mime;
  fontState.dataB64 = b64;
  fontState.buffer = buf;
  fontState.font = parsed;

  el.fontDropLabel.textContent = `Loaded: ${file.name}`;
  rebuild();
}

// Dropzone wiring
if (el.fontDrop && el.fontFile) {
  el.fontDrop.addEventListener('click', () => el.fontFile.click());
  el.fontDrop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fontFile.click(); }
  });
  el.fontFile.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadCustomFont(f);
  });
  ['dragenter','dragover'].forEach(ev =>
    el.fontDrop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      el.fontDrop.classList.add('dragover');
    })
  );
  ['dragleave','drop'].forEach(ev =>
    el.fontDrop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      el.fontDrop.classList.remove('dragover');
    })
  );
  el.fontDrop.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadCustomFont(f);
  });
}

// ---------- Builder ----------
function parseWords(str) {
  return str.split(',').map(s => s.trim()).filter(Boolean);
}
function polarToCartesian(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
const BIG = 8000;                 // half-path (px)
const PATH_LEN = 2 * BIG;         // total path length
const EDGE_GUARD = 10;            // stay away from ends
function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

function rebuild() {
  const words = parseWords(el.words.value);
  const n = words.length || 1;

  const fontSize      = parseInt(el.fontSize.value, 10);
  const radius        = parseInt(el.radius.value, 10);
  const angleOffset   = parseInt(el.angle.value, 10);
  const letterSpacing = parseFloat(el.letterSpacing.value);
  const startPx       = parseInt(el.startPx.value, 10);

  // UI mirrors
  el.fontSizeOut.textContent = `${fontSize}px`;
  el.radiusOut.textContent   = `${radius}px`;
  el.angleOut.textContent    = `${angleOffset}°`;
  el.lsOut.textContent       = `${letterSpacing}`;
  el.startPxOut.textContent  = `${startPx} px`;

  el.defs.innerHTML = '';
  el.labels.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + angleOffset;

    // Single, constant direction path (smooth at zero-crossing)
    const p0 = polarToCartesian(0, 0, -BIG, a);
    const p1 = polarToCartesian(0, 0,  BIG, a);

    const id = `spoke-${i}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('id', id);
    path.setAttribute('d', `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'none');
    el.defs.appendChild(path);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('font-size', fontSize);

    const familyStack = fontState.family
      ? `'${fontState.family}', Helvetica, Arial, sans-serif`
      : 'Helvetica, Arial, sans-serif';
    text.setAttribute('font-family', familyStack);
    text.setAttribute('letter-spacing', letterSpacing);

    const tp = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
    tp.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${id}`);

    let startOffsetPx = BIG + radius + startPx;
    startOffsetPx = clamp(startOffsetPx, EDGE_GUARD, PATH_LEN - EDGE_GUARD);
    tp.setAttribute('startOffset', String(startOffsetPx));
    tp.textContent = words[i];

    text.appendChild(tp);
    el.labels.appendChild(text);
  }
}

function updatePreviewRotation() {
  const x = parseInt(el.rotX.value, 10);
  const y = parseInt(el.rotY.value, 10);
  const z = parseInt(el.rotZ.value, 10);
  el.rotXOut.textContent = `${x}°`;
  el.rotYOut.textContent = `${y}°`;
  el.rotZOut.textContent = `${z}°`;
  el.stage.style.transform =
    `perspective(1200px) rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
}

// Export SVG (embed font)
function downloadSVG() {
  const clone = el.svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  if (fontState.family && fontState.dataB64 && fontState.mime) {
    const fmt = fontState.mime.split('/').pop();
    const style = document.createElement('style');
    style.textContent =
`@font-face{
  font-family:'${fontState.family}';
  src:url(data:${fontState.mime};base64,${fontState.dataB64}) format('${fmt}');
  font-weight:normal;font-style:normal;font-display:block;
}`;
    clone.insertBefore(style, clone.firstChild);
  }

  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'radial_text.svg' });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Export SVG (outlines) — Illustrator-safe
function svgEl(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }
function rad(deg){ return (deg * Math.PI) / 180; }

function downloadSVGOutlines() {
  if (!fontState.font) {
    alert('Load a font first (drag a .otf/.ttf/.woff/.woff2 into the panel).');
    return;
  }
  const font = fontState.font;
  const unitsPerEm = font.unitsPerEm || 1000;

  const out = svgEl('svg');
  out.setAttribute('xmlns','http://www.w3.org/2000/svg');
  out.setAttribute('viewBox','-600 -600 1200 1200');

  const group = svgEl('g');
  out.appendChild(group);

  const words   = parseWords(el.words.value);
  const n       = words.length || 1;
  const fs      = parseInt(el.fontSize.value, 10);
  const angle0  = parseInt(el.angle.value, 10);
  const radius  = parseInt(el.radius.value, 10);
  const startPx = parseInt(el.startPx.value, 10);
  const lsPx    = parseFloat(el.letterSpacing.value);

  const scale = fs / unitsPerEm;

  for (let i = 0; i < n; i++) {
    const aDeg = (360 / n) * i + angle0;
    const a = rad(aDeg);
    const cos = Math.cos(a), sin = Math.sin(a);
    let d = radius + startPx;

    const word = words[i];
    for (const ch of word) {
      const glyph = font.charToGlyph(ch);
      const p = glyph.getPath(0, 0, fs);
      const dPath = p.toPathData(2);

      const gx = cos * d;
      const gy = sin * d;

      // Flip Y (font Y-up vs SVG Y-down), rotate to spoke
      const g = svgEl('g');
      g.setAttribute('transform', `translate(${gx} ${gy}) rotate(${aDeg}) scale(1,-1)`);
      const path = svgEl('path');
      path.setAttribute('d', dPath);
      path.setAttribute('fill', '#111');
      g.appendChild(path);
      group.appendChild(g);

      const adv = glyph.advanceWidth * scale + lsPx;
      d += adv;
    }
  }

  const xml = new XMLSerializer().serializeToString(out);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'radial_text_outlines.svg' });
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// PNG EXACT (CSS 3D included) — transparent background
async function downloadPNGExact() {
  const prevBgStage = el.stage.style.background;
  el.stage.style.background = 'transparent';

  const save = (dataUrl) => {
    const link = document.createElement('a');
    link.download = 'radial_text_screen.png';
    link.href = dataUrl;
    link.click();
  };

  try {
    if (window.htmlToImage) {
      const dataUrl = await window.htmlToImage.toPng(el.stage, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: undefined,
        style: { background: 'transparent' }
      });
      save(dataUrl);
      el.stage.style.background = prevBgStage;
      return;
    }
  } catch (e) {
    console.warn('html-to-image failed, fallback…', e);
  }

  try {
    if (window.domtoimage) {
      const dataUrl = await window.domtoimage.toPng(el.stage, {
        quality: 1,
        bgcolor: undefined,
        width: el.stage.offsetWidth,
        height: el.stage.offsetHeight,
        style: { background: 'transparent', transform: getComputedStyle(el.stage).transform }
      });
      save(dataUrl);
    } else {
      throw new Error('dom-to-image-more not available');
    }
  } catch (e2) {
    console.error('PNG exact export failed:', e2);
    alert('Export PNG (exact) failed. Try Chrome desktop. SVG export still works.');
  } finally {
    el.stage.style.background = prevBgStage;
  }
}

function resetView() {
  el.rotX.value = 0; el.rotY.value = 0; el.rotZ.value = 0;
  updatePreviewRotation();
}

// Events
[
  el.words, el.fontSize, el.radius, el.angle, el.letterSpacing, el.startPx
].forEach(i => i.addEventListener('input', rebuild));
[ el.rotX, el.rotY, el.rotZ ].forEach(i => i.addEventListener('input', updatePreviewRotation));

el.downloadSvgBtn.addEventListener('click', downloadSVG);
el.downloadSvgOutlinesBtn.addEventListener('click', downloadSVGOutlines);
el.downloadPngExactBtn.addEventListener('click', downloadPNGExact);
el.reset.addEventListener('click', resetView);

// Init
rebuild();
updatePreviewRotation();
