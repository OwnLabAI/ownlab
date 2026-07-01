import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const desktopRoot = process.cwd();
const workspaceRoot = path.resolve(desktopRoot, '../..');
const sourceIconPath = path.resolve(desktopRoot, '../app/public/icon.svg');
const buildDir = path.resolve(desktopRoot, 'build');
const outputPngPath = path.join(buildDir, 'icon.png');
const requireFromServer = createRequire(path.join(workspaceRoot, 'apps/server/package.json'));
const sharp = requireFromServer('sharp');

const iconSvg = await readFile(sourceIconPath, 'utf8');
const masterPng = await renderMasterPng(iconSvg);
await sharp(masterPng).png().toFile(outputPngPath);

async function renderMasterPng(iconMarkup) {
  const canvasSize = 1024;
  const panelInset = 84;
  const panelSize = canvasSize - panelInset * 2;
  const symbolWidth = 640;
  const symbolHeight = 596;
  const symbolLeft = Math.round((canvasSize - symbolWidth) / 2);
  const symbolTop = Math.round((canvasSize - symbolHeight) / 2);

  const backgroundSvg = Buffer.from(
    `
      <svg width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="panel-shadow" x="0" y="0" width="${canvasSize}" height="${canvasSize}" color-interpolation-filters="sRGB">
            <feDropShadow dx="0" dy="28" stdDeviation="40" flood-color="#0f172a" flood-opacity="0.18"/>
          </filter>
          <linearGradient id="panel-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#eef2f7"/>
          </linearGradient>
        </defs>
        <rect x="${panelInset}" y="${panelInset}" width="${panelSize}" height="${panelSize}" rx="208" fill="url(#panel-fill)" filter="url(#panel-shadow)"/>
        <rect x="${panelInset}" y="${panelInset}" width="${panelSize}" height="${panelSize}" rx="208" fill="none" stroke="#d8e1ec" stroke-width="8"/>
      </svg>
    `,
  );

  const symbolPng = await sharp(Buffer.from(iconMarkup))
    .resize({
      width: symbolWidth,
      height: symbolHeight,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(backgroundSvg)
    .composite([{ input: symbolPng, left: symbolLeft, top: symbolTop }])
    .png()
    .toBuffer();
}
