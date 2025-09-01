// =====================
// Radial Text Builder — WYSIWYG outlines export
// =====================

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

function extToMime(name = '') {
  const ext = name.toLowerCase().split('.').pop();
  switch (ext) {
    case 'otf': return 'font/otf';
    case 'ttf': return 'font/ttf';
    case 'woff': return 'font/woff';
    case 'woff2': return 'font/woff2';
    default: return 'application/octet-stream';
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
  ['dragenter', 'dragover'].forEach(ev =>
    el.fontDrop.addEventListener(ev, (e) => {
      e.preventDefault(); e.stopPropagation();
      el.fontDrop.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach(ev =>
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

  const fontSize = parseInt(el.fontSize.value, 10);
  const radius = parseInt(el.radius.value, 10);
  const angleOffset = parseInt(el.angle.value, 10);
  const letterSpacing = parseFloat(el.letterSpacing.value);
  const startPx = parseInt(el.startPx.value, 10);

  // UI mirrors
  el.fontSizeOut.textContent = `${fontSize}px`;
  el.radiusOut.textContent = `${radius}px`;
  el.angleOut.textContent = `${angleOffset}°`;
  el.lsOut.textContent = `${letterSpacing}`;
  el.startPxOut.textContent = `${startPx} px`;

  el.defs.innerHTML = '';
  el.labels.innerHTML = '';

  for (let i = 0; i < n; i++) {
    const a = (360 / n) * i + angleOffset;

    // Single, constant direction path (smooth at zero-crossing)
    const p0 = polarToCartesian(0, 0, -BIG, a);
    const p1 = polarToCartesian(0, 0, BIG, a);

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
    text.setAttribute('letter-spacing', `${letterSpacing}px`);

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

const PERSPECTIVE_PX = 1200;

function updatePreviewRotation() {
  const x = parseInt(el.rotX.value, 10);
  const y = parseInt(el.rotY.value, 10);
  const z = parseInt(el.rotZ.value, 10);
  el.rotXOut.textContent = `${x}°`;
  el.rotYOut.textContent = `${y}°`;
  el.rotZOut.textContent = `${z}°`;
  el.stage.style.transform =
    `perspective(${PERSPECTIVE_PX}px) rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
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

// ---------- Helpers for SVG (outlines) export ----------
function svgEl(name) { return document.createElementNS('http://www.w3.org/2000/svg', name); }
function toRad(deg) { return (deg * Math.PI) / 180; }

// 4x4 matrix helpers to bake CSS perspective + rotations (origin at center)
function matMul(a, b) {
  const r = Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
      }
    }
  }
  return r;
}
function matRotateX(ax) {
  const c = Math.cos(ax), s = Math.sin(ax);
  return [
    1, 0, 0, 0,
    0, c, -s, 0,
    0, s, c, 0,
    0, 0, 0, 1
  ];
}
function matRotateY(ay) {
  const c = Math.cos(ay), s = Math.sin(ay);
  return [
    c, 0, s, 0,
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1
  ];
}
function matRotateZ(az) {
  const c = Math.cos(az), s = Math.sin(az);
  return [
    c, -s, 0, 0,
    s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ];
}
function matPerspective(d) {
  // CSS perspective(d) in px
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -1 / d, 1  // <-- m[14]
  ];
}
function applyMat(x, y, z, m) {
  const X = m[0] * x + m[1] * y + m[2] * z + m[3] * 1;
  const Y = m[4] * x + m[5] * y + m[6] * z + m[7] * 1;
  const Z = m[8] * x + m[9] * y + m[10] * z + m[11] * 1;
  const W = m[12] * x + m[13] * y + m[14] * z + m[15] * 1;
  const iw = (W !== 0) ? (1 / W) : 1;
  return { x: X * iw, y: Y * iw, z: Z * iw };
}

// ---------- Export SVG (outlines) — baked 3D, WYSIWYG ----------
function downloadSVGOutlines() {
  if (!fontState.font) {
    alert('Load a font first (drag a .otf/.ttf/.woff/.woff2 into the panel).');
    return;
  }
  const font = fontState.font;
  const unitsPerEm = font.unitsPerEm || 1000;

  const out = svgEl('svg');
  out.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  out.setAttribute('viewBox', '-600 -600 1200 1200');

  const group = svgEl('g');
  out.appendChild(group);

  // UI state (ALL parameters are honored)
  const words = parseWords(el.words.value);
  const n = words.length || 1;
  const fs = parseInt(el.fontSize.value, 10);     // font size
  const angle0 = parseInt(el.angle.value, 10);        // angle offset
  const radius = parseInt(el.radius.value, 10);       // radius
  const startPx = parseInt(el.startPx.value, 10);      // start offset
  const lsPx = parseFloat(el.letterSpacing.value);  // letter spacing (px)

  // Live preview rotations (deg)
  const rotXdeg = parseInt(el.rotX.value, 10);
  const rotYdeg = parseInt(el.rotY.value, 10);
  const rotZdeg = parseInt(el.rotZ.value, 10);

  // CSS: transform: perspective(p) rotateX(ax) rotateY(ay) rotateZ(az)
  // Applied right-to-left -> M = P · Rx · Ry · Rz
  const M = matMul(
    matPerspective(PERSPECTIVE_PX),
    matMul(
      matRotateX(toRad(rotXdeg)),
      matMul(
        matRotateY(toRad(rotYdeg)),
        matRotateZ(toRad(rotZdeg))
      )
    )
  );

  // From font units to pixels
  const scale = fs / unitsPerEm;

  // IMPORTANT: the stage applies perspective AFTER the SVG is scaled to its rendered size.
  // Compute that live scale (CSS px per viewBox unit) so projection matches exactly.
  const vbWidth = (el.svg.viewBox && el.svg.viewBox.baseVal) ? el.svg.viewBox.baseVal.width : 1200;
  const cssWidth = el.svg.getBoundingClientRect().width || 1200;
  const displayScale = cssWidth / vbWidth; // px per viewBox unit

  // Match on-screen clockwise sweep (your builder already does this)
  const SWEEP = 1;

  for (let i = 0; i < n; i++) {
    const aDeg = angle0 + SWEEP * (360 / n) * i;
    const aRad = toRad(aDeg - 90);     // same spoke angle as screen path
    const cosA = Math.cos(aRad), sinA = Math.sin(aRad);
    let d = radius + startPx;

    const word = words[i];

    // --- shape into glyphs (handles ligatures & script rules) ---
    // shape into glyphs for exact browser spacing (ligatures/kerning-ready)
    // shape into glyphs for exact browser spacing (ligatures/kerning-ready)
    const glyphs = font.stringToGlyphs(word);
    let prevGlyph = null;

    for (let gi = 0; gi < glyphs.length; gi++) {
      const glyph = glyphs[gi];

      // --- advance BEFORE placing the current glyph (pair kerning + letter-spacing) ---
      if (prevGlyph) {
        const kern = font.getKerningValue(prevGlyph, glyph) * scale; // px
        d += kern + lsPx; // SVG letter-spacing is added only between pairs
      }

      // --- place current glyph at penX + LSB ---
      const lsb = (glyph.leftSideBearing || 0) * scale;   // px along the baseline
      const p = glyph.getPath(0, 0, fs);

      function tx(x, y) {
        // rotate to the spoke tangent using the SAME angle as the screen path (aDeg - 90)
        const rx = x * Math.cos(aRad) + y * -Math.sin(aRad);
        const ry = x * Math.sin(aRad) + y * Math.cos(aRad);

        // translate along the spoke by (pen position + LSB)
        let gx = rx + cosA * (d + lsb);
        let gy = ry + sinA * (d + lsb);

        // project in CSS pixel space, then return to viewBox units
        gx *= displayScale; gy *= displayScale;
        const P = applyMat(gx, gy, 0, M);
        return { x: P.x / displayScale, y: P.y / displayScale };
      }

      // build path data
      let dStr = '';
      for (const cmd of p.commands) {
        if (cmd.type === 'M') { const q = tx(cmd.x, cmd.y); dStr += `M ${q.x} ${q.y} `; }
        else if (cmd.type === 'L') { const q = tx(cmd.x, cmd.y); dStr += `L ${q.x} ${q.y} `; }
        else if (cmd.type === 'C') {
          const q1 = tx(cmd.x1, cmd.y1), q2 = tx(cmd.x2, cmd.y2), q = tx(cmd.x, cmd.y);
          dStr += `C ${q1.x} ${q1.y} ${q2.x} ${q2.y} ${q.x} ${q.y} `;
        }
        else if (cmd.type === 'Q') {
          const q1 = tx(cmd.x1, cmd.y1), q = tx(cmd.x, cmd.y);
          dStr += `Q ${q1.x} ${q1.y} ${q.x} ${q.y} `;
        }
        else if (cmd.type === 'Z') { dStr += 'Z '; }
      }

      const path = svgEl('path');
      path.setAttribute('d', dStr.trim());
      path.setAttribute('fill', '#111');
      group.appendChild(path);

      // --- advance pen for the next glyph by the current glyph's advanceWidth ---
      d += glyph.advanceWidth * scale;
      prevGlyph = glyph;
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
[el.rotX, el.rotY, el.rotZ].forEach(i => i.addEventListener('input', updatePreviewRotation));

el.downloadSvgBtn.addEventListener('click', downloadSVG);
el.downloadSvgOutlinesBtn.addEventListener('click', downloadSVGOutlines);
el.downloadPngExactBtn.addEventListener('click', downloadPNGExact);
el.reset.addEventListener('click', resetView);

// Init
rebuild();
updatePreviewRotation();
