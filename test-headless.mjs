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
await page.setViewport({ width: 480, height: 720 });
page.setDefaultTimeout(120000);
page.on('pageerror', e => console.log('[PAGEERROR]', e.message));
await page.evaluateOnNewDocument(() => {
  localStorage.setItem('voidrunner_save_v1', JSON.stringify({
    v: 2, best: 0, xp: 0, equipped: 'cadet', runs: [], ghost: null,
    stats: { runs: 0, crystals: 0, gates: 0, dist: 0, nearMisses: 0, escapes: 0, kills: 0, playtime: 0, powerups: 0 },
    ach: {}, settings: { sound: true, quality: 'low', sens: 1, invertY: false, invertX: false, shake: 1, controlMode: 'aim', autofire: true, lefty: false, ghost: true }
  }));
});

let failures = 0;
const step = (name, ok, extra = '') => { if (!ok) failures++; console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (extra ? ' :: ' + extra : '')); };

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 8000));

step('engine booted', await page.evaluate(() => window.__vr === true));
step('main menu visible', await page.evaluate(() => !document.getElementById('menu-main').classList.contains('hidden')));
const playLbl = await page.$eval('#btn-play', el => el.textContent);
step('first launch offers training', playLbl === 'START TRAINING', playLbl);
const chipTxt = await page.$eval('#device-chip', el => el.textContent);
step('device chip populated', chipTxt.length > 5, chipTxt);
await page.screenshot({ path: 'test-menu.png' });

await page.click('#btn-play');
await new Promise(r => setTimeout(r, 600));
const tutShown = await page.evaluate(() => !document.getElementById('tut-card').classList.contains('hidden'));
const tutState = await page.evaluate(() => window.__vrDebug());
step('tutorial card appears on first launch', tutShown && tutState.tutOn && tutState.tutStep === 0, 'step=' + tutState.tutStep);
await page.screenshot({ path: 'test-tutorial.png' });
await page.click('#tut-skip');
await new Promise(r => setTimeout(r, 600));
const tutDone = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrunner_save_v1')).tutorialDone);
const tutHidden = await page.evaluate(() => document.getElementById('tut-card').classList.contains('hidden'));
step('skip training persists + hides card', tutDone === true && tutHidden);
await page.keyboard.press('KeyP');
await new Promise(r => setTimeout(r, 500));
await page.click('#btn-quit');
await new Promise(r => setTimeout(r, 600));
step('back at menu with LAUNCH label', (await page.$eval('#btn-play', el => el.textContent)) === 'LAUNCH MISSION');

await page.click('#btn-hangar');
await new Promise(r => setTimeout(r, 600));
step('hangar renders 7 skins', (await page.$$eval('.skin-card', els => els.length)) === 7);
await page.click('#hangar-back');
await new Promise(r => setTimeout(r, 400));

await page.click('#btn-profile');
await new Promise(r => setTimeout(r, 500));
const statCells = await page.$$eval('#profile-stats div', els => els.length);
const runRows = await page.$$eval('#profile-runs .run-row', els => els.length);
step('profile renders 10 stat cells', statCells === 10, 'cells=' + statCells);
step('profile shows empty runs state', runRows === 1 && (await page.$eval('#profile-runs', el => el.textContent.includes('NO RUNS'))));
await page.screenshot({ path: 'test-profile.png' });
await page.click('#profile-back');
await new Promise(r => setTimeout(r, 400));

await page.click('#btn-ach');
await new Promise(r => setTimeout(r, 500));
step('achievements render 14 rows', (await page.$$eval('.ach-row', els => els.length)) === 14);
await page.click('#ach-back');
await new Promise(r => setTimeout(r, 400));

await page.click('#btn-settings');
await new Promise(r => setTimeout(r, 500));
const radios = await page.$$eval('input[name="ctlmode"]', els => els.length);
step('mouse mode radios present', radios === 3);
await page.click('input[name="ctlmode"][value="stick"]');
await new Promise(r => setTimeout(r, 200));
const savedMode = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrunner_save_v1')).settings.controlMode);
step('control mode persists to storage', savedMode === 'stick', savedMode);
await page.click('input[name="ctlmode"][value="aim"]');
await page.click('#settings-back');
await new Promise(r => setTimeout(r, 400));

await page.click('#btn-play');
await new Promise(r => setTimeout(r, 400));
step('run starts (body.playing)', await page.evaluate(() => document.body.classList.contains('playing')));

let playing = false;
for (let i = 0; i < 60 && !playing; i++) {
  await new Promise(r => setTimeout(r, 2000));
  playing = await page.evaluate(() => window.__vrDebug().mode === 'play');
}
step('reached PLAY mode', playing);

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
  step('debug exposes v2 systems', typeof d1.heat === 'number' && typeof d1.sector === 'number' && typeof d1.objectives === 'string');

  await page.keyboard.press('KeyP');
  await new Promise(r => setTimeout(r, 1500));
  step('pause opens with objectives', await page.evaluate(() => {
    const ok = !document.getElementById('pause-overlay').classList.contains('hidden');
    const objs = document.querySelectorAll('#pause-objectives .obj-row').length;
    return ok && objs === 3;
  }), 'objs=' + await page.evaluate(() => document.querySelectorAll('#pause-objectives .obj-row').length));
  await page.screenshot({ path: 'test-pause.png' });
  await page.click('#btn-resume');
  await new Promise(r => setTimeout(r, 1500));
  step('resume returns to play', (await page.evaluate(() => window.__vrDebug().mode)) === 'play');

  await page.keyboard.press('KeyM');
  await new Promise(r => setTimeout(r, 400));
  step('mute toggles', (await page.evaluate(() => document.getElementById('btn-mute').textContent)) === 'AUDIO OFF');

  await page.keyboard.press('KeyP');
  await new Promise(r => setTimeout(r, 800));
  await page.click('#btn-quit');
  await new Promise(r => setTimeout(r, 800));
  const backAtMenu = await page.evaluate(() => !document.getElementById('menu-main').classList.contains('hidden'));
  const cleanState = await page.evaluate(() => !document.body.classList.contains('playing'));
  step('abandon run returns to clean menu', backAtMenu && cleanState);
} else {
  step('play mode reachable', false, 'timeout');
}

await page.screenshot({ path: 'test-end.png' });
await browser.close();
server.close();
console.log(failures ? `RESULT: ${failures} FAILURES` : 'RESULT: ALL TESTS PASSED');
process.exit(failures ? 1 : 0);
