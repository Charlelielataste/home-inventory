// Generates the app icon, Android adaptive icon layers, splash image and favicon
// from the two source illustrations in assets/source/.
//
//   node scripts/build-app-icons.mjs
//
// Sources:
//   assets/source/icon.png              full icon (opaque, lagoon background)
//   assets/source/icon-transparent.png  same illustration on a transparent background
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');

const LAGOON = '#2E4A5E';
const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root));
const dataUri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

const full = read('assets/source/icon.png');
const transparent = read('assets/source/icon-transparent.png');

function render(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render();
}
function write(path, svg, size) {
  writeFileSync(new URL(path, root), render(svg, size).asPng());
  console.log(`${path} (${size}px)`);
}

/** Bounding box of the non-transparent pixels, in source pixels. */
function subjectBox(png) {
  const probe = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1024" height="1024"><image href="${dataUri(png)}" width="1024" height="1024"/></svg>`,
  ).render();
  const { width, height, pixels } = probe;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * The transparent illustration, cropped to its subject and centered so that its
 * largest side takes `fill` of a 1024 canvas. Optional background color and filter.
 */
function centered(fill, { background, filter } = {}) {
  const box = subjectBox(transparent);
  const scale = (1024 * fill) / Math.max(box.w, box.h);
  const dx = 512 - (box.x + box.w / 2) * scale;
  const dy = 512 - (box.y + box.h / 2) * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs><filter id="mono" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1.8 -3.54 -0.66 6 -3"/></filter></defs>
  ${background ? `<rect width="1024" height="1024" fill="${background}"/>` : ''}
  <image href="${dataUri(transparent)}" x="${dx}" y="${dy}" width="${1024 * scale}" height="${1024 * scale}" ${filter ? 'filter="url(#mono)"' : ''}/>
</svg>`;
}

const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><image href="${dataUri(full)}" width="1024" height="1024"/></svg>`;

// Store / iOS icon: the full illustration as is
write('assets/images/icon.png', fullSvg, 1024);
write('assets/images/favicon.png', fullSvg, 48);

// Android adaptive icon: launchers mask the layers (circle, squircle…) and only
// guarantee a centered circle of 66% → keep the subject inside ~56%.
write('assets/images/android-icon-foreground.png', centered(0.56), 1024);
write('assets/images/android-icon-background.png', `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${LAGOON}"/></svg>`, 1024);
// Themed icons (Android 13+): single color, tinted by the system → keep the dark outlines only
// (alpha = 6 × (alpha − luminance) − 3)
write('assets/images/android-icon-monochrome.png', centered(0.56, { filter: true }), 1024);

// Splash: Android 12+ crops the splash image to a circle (2/3 of its size)
write('assets/images/splash-icon.png', centered(0.56), 1024);
