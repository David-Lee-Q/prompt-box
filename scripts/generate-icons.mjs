import { chromium } from '@playwright/test';

const svgContent = `<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1780642993609" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15867" xmlns:xlink="http://www.w3.org/1999/xlink" width="256" height="256"><path d="M816.42361995 935.7671032H208.65084682c-66.21563259 0-119.88718933-53.67155675-119.88718934-119.88718933V208.12008613c0-66.21563259 53.67155675-119.88718933 119.88718934-119.88718933h607.77277313c66.21563259 0 119.88718933 53.67155675 119.88718933 119.88718933v607.77277312c0 66.2026872-53.67155675 119.87424395-119.88718933 119.87424395z" fill="#0E8CFB" p-id="15868"></path><path d="M552.82973709 357.91110953l41.38638854 308.19072632h-93.63395318l-10.90001226-83.88608H359.01146706l-36.51892464 83.88608h-88.7535439l120.35322311-292.94106548-15.78042153-15.23671546h214.51793699z m-120.30144159 52.23461927l-52.28640078 119.8224624h104.53396543l-15.78042154-119.8224624h-36.46714311z" fill="#FFFFFF" p-id="15869"></path><path d="M791.30957748 357.91110953l-47.36715535 308.19072632H644.81962667l36.51892464-287.49105935-15.81925768-20.69966697h125.79028385z" fill="#C6E5F7" p-id="15870"></path></svg>`;

const sizes = [16, 32, 48, 128];

const html = `<!DOCTYPE html><html><body style="margin:0;padding:0">${sizes.map(s =>
  `<canvas id="c${s}" width="${s}" height="${s}" style="display:none"></canvas>`
).join('')}<script>
const svg = ${JSON.stringify(svgContent)};
const img = new Image();
const svgBlob = new Blob([svg], {type:'image/svg+xml'});
img.src = URL.createObjectURL(svgBlob);
img.onload = function() {
  ${sizes.map(s => `
  const c${s} = document.getElementById('c${s}');
  c${s}.getContext('2d').drawImage(img,0,0,${s},${s});
  c${s}.style.display='block';
  `).join('')}
  document.title = 'DONE';
};
</script></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 200, height: 200 } });
await page.setContent(html);
await page.waitForFunction(() => document.title === 'DONE');

import fs from 'fs';
import path from 'path';

const iconsDir = path.resolve('public-ext/icons');
for (const s of sizes) {
  const dataUrl = await page.evaluate((size) => {
    const c = document.getElementById('c' + size);
    return c.toDataURL('image/png');
  }, s);
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(path.join(iconsDir, `icon${s}.png`), Buffer.from(base64, 'base64'));
  console.log(`  icon${s}.png (${Buffer.from(base64, 'base64').length} bytes)`);
}

await browser.close();
console.log('Done — icons generated in public-ext/icons/');
