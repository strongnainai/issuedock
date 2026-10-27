// Optional integration test: uses a locally installed Chromium browser, no npm packages.
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const candidates = [process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
const browser = candidates.find(candidate => fs.existsSync(candidate));
if (!browser) throw new Error('Set BROWSER_PATH to an installed Chromium browser executable.');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'issuedock-browser-'));
const server = createServer((req, res) => {
  const filename = ({ '/': 'index.html', '/index.html': 'index.html', '/styles.css': 'styles.css', '/core.js': 'core.js', '/app.js': 'app.js' })[req.url];
  if (!filename) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', filename.endsWith('.css') ? 'text/css' : filename.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root, filename)));
});
let proc;
let serial = 0;
const pending = new Map();
let errors = [];
let session;
let browserStderr = '';
let browserExit = '';
function rejectPending(error) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
}
function send(method, params = {}, sessionId) {
  const id = ++serial;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}${browserExit ? ` (${browserExit})` : ''}`));
    }, 12000);
    pending.set(id, { resolve, reject, timer });
    proc.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function ready() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await evaluate("document.readyState === 'complete' && document.querySelectorAll('.column').length === 3")) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('App did not become ready');
}
async function waitFor(expression, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(message);
}
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  proc = spawn(browser, ['--headless', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true });
  proc.stderr.on('data', chunk => { browserStderr = (browserStderr + chunk.toString()).slice(-8000); });
  proc.once('exit', (code, signal) => { browserExit = `browser exited: code=${code}, signal=${signal || 'none'}`; });
  proc.on('error', error => rejectPending(error));
  proc.stdio[3].on('error', error => rejectPending(error));
  proc.stdio[4].on('error', error => rejectPending(error));
  let buffer = '';
  proc.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
      const data = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      const request = pending.get(data.id);
      if (request) { clearTimeout(request.timer); pending.delete(data.id); data.error ? request.reject(new Error(JSON.stringify(data.error))) : request.resolve(data.result); }
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails);
    }
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Runtime.enable', {}, session);
  await send('Page.enable', {}, session);
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, session);
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` }, session);
  await ready();
  assert.equal(await evaluate("document.getElementById('total-count').textContent"), '0');
  assert.equal(await evaluate("document.getElementById('storage-status-text').textContent"), '数据保存在此浏览器');
  assert.ok(await evaluate("performance.getEntriesByType('resource').every(entry => new URL(entry.name).origin === location.origin)"), 'app must not load external resources');
  assert.ok(await evaluate("[...document.querySelectorAll('input:not([type=hidden]):not([hidden]), select, textarea')].every(element => element.labels.length > 0 || element.getAttribute('aria-label'))"), 'every form control needs an accessible name');
  assert.equal(await evaluate("document.getElementById('task-dialog').getAttribute('aria-labelledby')"), 'dialog-title');
  await evaluate("document.getElementById('add-task').click()");
  assert.ok(await evaluate("document.getElementById('task-dialog').open"));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, session);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, session);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(!(await evaluate("document.getElementById('task-dialog').open")), 'Escape closes the task dialog');
  await evaluate("document.getElementById('load-demo').click()");
  assert.equal(await evaluate("document.querySelectorAll('.card').length"), 4);
  const hostile = '<img src=x onerror=alert(1)>';
  await evaluate(`document.getElementById('add-task').click(); document.getElementById('task-title').value=${JSON.stringify(hostile)}; document.getElementById('task-project').value='Integration'; document.getElementById('task-form').requestSubmit()`);
  assert.equal(await evaluate("document.querySelectorAll('.card').length"), 5);
  assert.equal(await evaluate("document.querySelectorAll('.card img').length"), 0);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(await evaluate("document.activeElement.classList.contains('edit')"), 'focus returns to the saved task');
  await evaluate("document.querySelector('.card-tools button').click(); document.getElementById('task-title').value='Edited task'; document.getElementById('task-form').requestSubmit()");
  assert.equal(await evaluate("document.querySelector('.card h3').textContent"), 'Edited task');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(await evaluate("document.activeElement.classList.contains('edit')"), 'focus returns after editing');
  await evaluate("const status=document.querySelector('.card-bottom select'); status.value='done'; status.dispatchEvent(new Event('change'))");
  assert.equal(await evaluate("document.getElementById('done-count').textContent"), '2');
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(await evaluate("document.activeElement.tagName"), 'SELECT', 'status control keeps focus after rerender');
  assert.ok(await evaluate("document.activeElement.closest('.card').dataset.taskId"), 'focused status control belongs to the edited task');
  await evaluate("document.getElementById('search').value='Edited'; document.getElementById('search').dispatchEvent(new Event('input'))");
  assert.equal(await evaluate("document.querySelectorAll('.card').length"), 1);
  await evaluate("document.getElementById('reset-filters').click()");
  await send('Page.reload', {}, session);
  await ready();
  assert.equal(await evaluate("document.getElementById('total-count').textContent"), '5');
  // Exercise the real asynchronous file-import handler and replacement confirmation.
  await evaluate(`window.confirm=()=>true; const data=JSON.parse(localStorage.getItem('issuedock.tasks.v1')); data.tasks=data.tasks.filter(t=>!t.id.startsWith('demo-')); const transfer=new DataTransfer(); transfer.items.add(new File([JSON.stringify(data)],'restore.json',{type:'application/json'})); const input=document.getElementById('import-file'); input.files=transfer.files; input.dispatchEvent(new Event('change'));`);
  let restored = false;
  for (let i = 0; i < 60; i++) {
    if (await evaluate("document.getElementById('total-count').textContent === '1'")) { restored = true; break; }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(restored, 'file import replaces data');
  await evaluate("document.querySelector('.delete').click()");
  assert.equal(await evaluate("document.getElementById('total-count').textContent"), '0');
  await evaluate("document.getElementById('load-demo').click()");
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, session);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= 390'), 'mobile page must not overflow horizontally');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: true }, session);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= 320'), 'narrow mobile page must not overflow horizontally');
  await evaluate("document.getElementById('add-task').click()");
  assert.ok(await evaluate("(() => { const box=document.getElementById('task-dialog').getBoundingClientRect(); return box.top >= 0 && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight; })()"), 'dialog must fit the narrow viewport');
  await evaluate("document.getElementById('task-dialog').close()");
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false }, session);
  await evaluate('document.fonts.ready');
  await evaluate("document.getElementById('notice').hidden=true");
  await evaluate('document.activeElement.blur()');
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }, session);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'screenshot.png'), Buffer.from(screenshot.data, 'base64'));
  // A malformed store must block writes, then a valid backup must be able to recover it.
  await evaluate("localStorage.setItem('issuedock.tasks.v1', '{broken')");
  await send('Page.reload', {}, session);
  await ready();
  assert.equal(await evaluate("document.getElementById('total-count').textContent"), '0');
  assert.equal(await evaluate("document.getElementById('storage-status-text').textContent"), '保存已暂停');
  assert.equal(await evaluate("document.getElementById('storage-status').dataset.state"), 'blocked');
  await evaluate(`window.confirm=()=>true; const valid=window.IssueDockCore.backup([{id:'recovered',title:'恢复后的任务',project:'',description:'',status:'backlog',priority:'medium',createdAt:'2026-10-27T00:00:00.000Z'}]); const transfer=new DataTransfer(); transfer.items.add(new File([valid],'recover.json',{type:'application/json'})); const input=document.getElementById('import-file'); input.files=transfer.files; input.dispatchEvent(new Event('change'));`);
  await waitFor("document.getElementById('total-count').textContent === '1'", 'valid backup did not recover blocked storage');
  assert.equal(await evaluate("document.getElementById('storage-status-text').textContent"), '数据保存在此浏览器');
  assert.deepEqual(errors, [], 'no uncaught browser exceptions');
  console.log('Browser smoke passed: CRUD, keyboard, focus, accessibility, text safety, storage recovery and responsive layout.');
}
main().catch(async error => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const details = [error?.stack || String(error), `Browser: ${browser}`, browserExit, browserStderr].filter(Boolean).join(' | ');
  console.error(details);
  if (process.env.GITHUB_ACTIONS) {
    const annotation = details.replace(/\s+/g, ' ').slice(0, 6000).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.error(`::error file=tests/browser-smoke.cjs,line=1,title=Browser smoke failed::${annotation}`);
  }
  process.exitCode = 1;
}).finally(async () => {
  if (proc && proc.exitCode === null) {
    await send('Browser.close').catch(() => proc.kill());
    if (proc.exitCode === null) await new Promise(resolve => { const timer = setTimeout(() => { proc.kill(); resolve(); }, 3000); proc.once('exit', () => { clearTimeout(timer); resolve(); }); });
  }
  for (const request of pending.values()) clearTimeout(request.timer);
  server.close();
  const safeProfile = path.resolve(profile);
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  if (safeProfile.startsWith(tempRoot) && path.basename(safeProfile).startsWith('issuedock-browser-')) fs.rmSync(safeProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});
