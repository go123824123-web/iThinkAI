/**
 * Render icons/icon.svg to 16/48/128 PNGs using Playwright.
 * Run: node store/render-icons.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'icons/icon.svg');
const OUTPUT_DIR = path.join(ROOT, 'icons');
const SIZES = [16, 48, 128];

(async () => {
  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  const browser = await chromium.launch();
  const context = await browser.newContext({ deviceScaleFactor: 1 });

  for (const size of SIZES) {
    const page = await context.newPage();
    await page.setViewportSize({ width: size, height: size });
    const html = `<!doctype html><html><head><style>
      html, body { margin: 0; padding: 0; background: transparent; }
      svg { display: block; width: ${size}px; height: ${size}px; }
    </style></head><body>${svg}</body></html>`;
    await page.setContent(html);
    await page.waitForLoadState('networkidle');
    const buffer = await page.screenshot({
      type: 'png',
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    });
    const out = path.join(OUTPUT_DIR, `icon${size}.png`);
    fs.writeFileSync(out, buffer);
    console.log(`wrote ${out} (${buffer.length} bytes)`);
    await page.close();
  }

  await browser.close();
})();
