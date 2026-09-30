// CI-only check of the installed executable. No test hooks are added to the app.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { websiteURL } = require('../url-policy.cjs');
const site = websiteURL(process.env.BUILDX_DESKTOP_URL || require('../package.json').buildxUrl);
const port = 24719;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const child = spawn(process.argv[2], [`--remote-debugging-port=${port}`], { stdio: 'ignore' });
  let socket;
  try {
    let page;
    for (let attempt = 0; attempt < 120 && !page; attempt++) {
      if (child.exitCode !== null) throw new Error('Installed app exited before loading');
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json`, { signal: AbortSignal.timeout(2000) });
        page = (await response.json()).find(item => item.type === 'page' && item.url.startsWith(site.origin + '/'));
      } catch { /* The desktop window may still be starting. */ }
      if (!page) await sleep(1000);
    }
    assert.ok(page, 'Installed app should open the configured website');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Error('Cannot inspect installed app')), { once: true });
    });
    let id = 0;
    const request = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      const timer = setTimeout(() => { socket.removeEventListener('message', receive); reject(new Error('Desktop inspection timed out')); }, 10000);
      function receive(event) {
        const message = JSON.parse(event.data);
        if (message.id !== requestId) return;
        clearTimeout(timer); socket.removeEventListener('message', receive);
        if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
      }
      socket.addEventListener('message', receive);
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    let state;
    for (let attempt = 0; attempt < 120; attempt++) {
      const result = await request('Runtime.evaluate', { returnByValue: true, expression: `({
        ready: document.readyState === 'complete' && !!document.querySelector('main') && document.querySelector('.boot-content')?.getAttribute('aria-hidden') !== 'true',
        desktop: navigator.userAgent.includes('BuildXDesktop/'),
        download: [...document.querySelectorAll('button,a')].some(el => el.textContent.includes('Download Desktop')),
        isolated: typeof window.require === 'undefined' && typeof window.process === 'undefined'
      })` });
      state = result.result.value;
      if (state?.ready) break;
      await sleep(1000);
    }
    assert.ok(state?.ready, 'Hosted BuildX should finish loading');
    assert.ok(state.desktop, 'Installed app should identify itself');
    assert.equal(state.download, false, 'Installer controls must be absent in desktop');
    assert.ok(state.isolated, 'Website must not have Node access');
    const screenshot = await request('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`desktop/dist/desktop-smoke-${process.platform}.png`, Buffer.from(screenshot.data, 'base64'));
    console.log('Installed desktop smoke check passed: live website, desktop marker, no download controls, no Node access.');
  } finally {
    socket?.close();
    if (child.pid) {
      if (process.platform === 'win32') {
        try { execFileSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' }); } catch { /* Already closed. */ }
      } else child.kill();
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
