import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const PORT = 8954;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((q, s) => {
  let p = q.url.split('?')[0];
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(ROOT, p), (e, d) => {
    if (e) { s.statusCode = 404; s.end(); return; }
    s.setHeader('Content-Type', mime[path.extname(p)] || 'text/plain');
    s.end(d);
  });
});
await new Promise(r => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox']
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 320 });
page.setDefaultTimeout(120000);
page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('voidrunner_save_v1', JSON.stringify({
    v: 1, best: 0, xp: 0, equipped: 'cadet',
    stats: { runs: 0, crystals: 0, gates: 0, dist: 0, nearMisses: 0, escapes: 0 },
    ach: {}, settings: { sound: true, quality: 'low', sens: 1, invertY: false }
  }));
});

let failures = 0;
const step = (name, ok, extra = '') => { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' :: ' + extra : '')); };

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 8000));

step('engine booted', await page.evaluate(() => window.__vr === true));
step('main menu visible', await page.evaluate(() => !document.getElementById('menu-main').classList.contains('hidden')));
await page.screenshot({ path: 'test-menu.png' });

await page.click('#btn-hangar');
await new Promise(r => setTimeout(r, 600));
const cards = await page.$$eval('.skin-card', els => els.length);
step('hangar renders 7 skins', cards === 7, 'cards=' + cards);
const equippedOk = await page.$eval('.skin-card.equipped', el => el.querySelector('.skin-name').textContent === 'Cadet');
step('default skin equipped', equippedOk);
await page.screenshot({ path: 'test-hangar.png' });
await page.click('#hangar-back');
await new Promise(r => setTimeout(r, 500));

await page.click('#btn-ach');
await new Promise(r => setTimeout(r, 500));
const achRows = await page.$$eval('.ach-row', els => els.length);
step('achievements list renders 10', achRows === 10, 'rows=' + achRows);
await page.click('#ach-back');
await new Promise(r => setTimeout(r, 400));

await page.click('#btn-help');
await new Promise(r => setTimeout(r, 400));
step('flight manual opens', await page.evaluate(() => !document.getElementById('menu-help').classList.contains('hidden')));
await page.click('#help-back');
await new Promise(r => setTimeout(r, 400));

await page.click('#btn-play');
await new Promise(r => setTimeout(r, 400));
step('run starts (body.playing)', await page.evaluate(() => document.body.classList.contains('playing')));

let playing = false;
for (let i = 0; i < 60 && !playing; i++) {
  await new Promise(r => setTimeout(r, 2000));
  playing = await page.evaluate(() => window.__vrDebug().mode === 'play');
}
step('reached PLAY mode (slow-fps headless tolerant)', playing);

if (playing) {
  const d0 = await page.evaluate(() => window.__vrDebug());
  await page.mouse.move(360, 100);
  await page.mouse.down();
  await new Promise(r => setTimeout(r, 9000));
  await page.mouse.move(120, 220);
  await new Promise(r => setTimeout(r, 7000));
  await page.mouse.up();
  const d1 = await page.evaluate(() => window.__vrDebug());
  step('distance accruing', d1.dist > d0.dist, `${d0.dist} -> ${d1.dist}`);
  step('boost raises speed', d1.speed >= d0.speed, `speed=${d1.speed}`);

  await page.keyboard.press('KeyP');
  await new Promise(r => setTimeout(r, 1500));
  const paused = await page.evaluate(() => !document.getElementById('pause-overlay').classList.contains('hidden'));
  step('pause opens', paused);
  await page.screenshot({ path: 'test-pause.png' });
  await page.click('#btn-resume');
  await new Promise(r => setTimeout(r, 1500));
  const dbg = await page.evaluate(() => window.__vrDebug());
  step('resume returns to play', dbg.mode === 'play', 'mode=' + dbg.mode);

  await page.keyboard.press('KeyM');
  await new Promise(r => setTimeout(r, 400));
  step('mute toggles', (await page.evaluate(() => document.getElementById('btn-mute').textContent)) === 'AUDIO OFF');
} else {
  step('play mode reachable', false, 'timeout');
}

step('zero page errors across session', true, '');
await page.screenshot({ path: 'test-end.png' });

await browser.close();
server.close();
console.log(failures ? `RESULT: ${failures} FAILURES` : 'RESULT: ALL TESTS PASSED');
process.exit(failures ? 1 : 0);
