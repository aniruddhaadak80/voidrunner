import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 320 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('https://voidrunner-neon.vercel.app/', { waitUntil: 'networkidle2', timeout: 90000 });
await new Promise(r => setTimeout(r, 10000));
const booted = await page.evaluate(() => window.__vr === true);
const menu = await page.evaluate(() => !document.getElementById('menu-main').classList.contains('hidden'));
await page.click('#btn-play');
let playing = false;
for (let i = 0; i < 40 && !playing; i++) {
  await new Promise(r => setTimeout(r, 2000));
  playing = await page.evaluate(() => window.__vrDebug().mode === 'play');
}
let distOk = false;
if (playing) {
  await page.mouse.move(240, 160);
  await page.mouse.down();
  await new Promise(r => setTimeout(r, 12000));
  await page.mouse.up();
  const d = await page.evaluate(() => window.__vrDebug());
  distOk = d.dist > 0 && d.speed > 0;
  console.log('live sim:', JSON.stringify(d));
}
await browser.close();
console.log('LIVE BOOT:', booted ? 'OK' : 'FAIL');
console.log('LIVE MENU:', menu ? 'OK' : 'FAIL');
console.log('LIVE PLAY MODE:', playing ? 'OK' : 'FAIL');
console.log('LIVE SIMULATION:', distOk ? 'OK' : 'FAIL');
console.log('LIVE ERRORS:', errors.length === 0 ? 'NONE' : errors.slice(0, 3).join(' | '));
process.exit(booted && menu && playing && distOk && errors.length === 0 ? 0 : 1);
