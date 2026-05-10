import { createRequire } from 'node:module';
import { readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SCREENSHOTS_DIR = join(ROOT, 'temporary screenshots');

// Try known Puppeteer install paths — update if neither matches your machine
const PUPPETEER_PATHS = [
  'C:/Users/nateh/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer',
  'C:/Users/shani/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer',
];

let puppeteer;
for (const p of PUPPETEER_PATHS) {
  try { puppeteer = require(p); break; } catch {}
}
if (!puppeteer) {
  throw new Error('Puppeteer not found. Update PUPPETEER_PATHS in screenshot.mjs.');
}

const [,, url = 'http://localhost:3000', label] = process.argv;

if (!existsSync(SCREENSHOTS_DIR)) await mkdir(SCREENSHOTS_DIR, { recursive: true });

const existing = (await readdir(SCREENSHOTS_DIR)).filter(f => f.endsWith('.png'));
const next = existing.length + 1;
const filename = label ? `screenshot-${next}-${label}.png` : `screenshot-${next}.png`;
const outPath = join(SCREENSHOTS_DIR, filename);

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.screenshot({ path: outPath });
await browser.close();

console.log(`Screenshot saved: temporary screenshots/${filename}`);
