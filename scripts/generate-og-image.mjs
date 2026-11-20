#!/usr/bin/env node
/**
 * generate-og-image.mjs — render public/og-docs.png (1200×630).
 *
 * The site advertises `og:image` and `twitter:image` on every page; if that URL
 * 404s, every share card (Slack, Discord, X, Google) renders blank. This script
 * draws the card with sharp from the site palette, so the image is reproducible
 * and always in step with the brand: run it in `prebuild`, commit nothing large.
 *
 * Palette mirrors src/styles/custom.css (dark-only Catppuccin-ish warm neutral
 * with an amber primary). Text uses DejaVu Sans, the sans available at build
 * time on Linux CI images.
 *
 * Usage: node scripts/generate-og-image.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib/docs-meta.mjs';

const OUT = resolve(ROOT, 'public/og-docs.png');
const LOGO = resolve(ROOT, 'src/assets/logo.png');
const W = 1200;
const H = 630;

const BG = '#161412'; // --background
const SURFACE = '#211f1b'; // --surface-1
const PRIMARY = '#c4915a'; // --primary
const FG = '#f2efec'; // --foreground
const MUTED = '#9c9691'; // --muted-foreground

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="18%" cy="8%" r="78%">
      <stop offset="0%" stop-color="${PRIMARY}" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="${PRIMARY}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${PRIMARY}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- hairline frame + corner marks: a docs sheet, not a marketing splash -->
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${SURFACE}" stroke-width="2"/>
  <path d="M40 88 L40 40 L88 40" fill="none" stroke="${PRIMARY}" stroke-width="3"/>

  <text x="188" y="106" font-family="DejaVu Sans" font-size="21" font-weight="bold"
        letter-spacing="5.5" fill="${PRIMARY}">DOCUMENTATION</text>

  <text x="80" y="300" font-family="DejaVu Sans" font-size="92" font-weight="bold"
        fill="${FG}">Catalyst Docs</text>

  <rect x="84" y="336" width="150" height="5" fill="url(#rule)"/>

  <text x="80" y="416" font-family="DejaVu Sans" font-size="33" fill="${FG}" fill-opacity="0.92">Run game servers without the guesswork.</text>
  <text x="80" y="466" font-family="DejaVu Sans" font-size="27" fill="${MUTED}">Install, operate, and automate the Catalyst control panel.</text>

  <line x1="80" y1="528" x2="${W - 80}" y2="528" stroke="${SURFACE}" stroke-width="2"/>
  <text x="80" y="568" font-family="DejaVu Sans Mono" font-size="24" fill="${MUTED}">docs.catalystctl.com</text>
  <text x="${W - 80}" y="568" font-family="DejaVu Sans" font-size="22" fill="${PRIMARY}" text-anchor="end">Panel · Node · Server · API</text>
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });
const logo = await sharp(LOGO).resize(88, 88, { fit: 'contain' }).png().toBuffer();
await sharp(Buffer.from(svg))
  .composite([{ input: logo, top: 64, left: 80 }])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
console.log(`generate-og-image: ${OUT} (${meta.width}×${meta.height})`);
