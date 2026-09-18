import fs from "node:fs";

import sharp from "sharp";

const svg = fs.readFileSync("public/nexclinic-mark.svg");

async function makeIcon(size, out) {
  const radius = Math.round(size * 0.18);
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" rx="${radius}" fill="#0B1F3A"/></svg>`
  );
  const pad = Math.round(size * 0.14);
  const inner = size - pad * 2;
  const mark = await sharp(svg).resize(inner, inner).png().toBuffer();
  await sharp(bg)
    .composite([{ input: mark, left: pad, top: pad }])
    .png()
    .toFile(out);
  console.log("wrote", out);
}

await makeIcon(192, "public/icon-192.png");
await makeIcon(512, "public/icon-512.png");
await makeIcon(180, "public/apple-touch-icon.png");

const ogW = 1200;
const ogH = 630;
const ogBg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ogW}" height="${ogH}">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B1F3A"/>
      <stop offset="55%" stop-color="#0F766E"/>
      <stop offset="100%" stop-color="#14532D"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#b)"/>
</svg>`);
const markLarge = await sharp(svg).resize(220, 220).png().toBuffer();
const word = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="560" height="130">
  <text x="0" y="72" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700" fill="#FFFFFF">NexClinic</text>
  <text x="4" y="110" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#99F6E4" letter-spacing="2">GESTION MEDICA INTELIGENTE</text>
</svg>`);
const wordPng = await sharp(word).png().toBuffer();
await sharp(ogBg)
  .composite([
    { input: markLarge, left: 120, top: 205 },
    { input: wordPng, left: 380, top: 245 },
  ])
  .png()
  .toFile("public/og-image.png");
console.log("wrote public/og-image.png");
