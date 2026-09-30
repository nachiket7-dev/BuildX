const { app, BrowserWindow, dialog, Menu, shell } = require('electron');
const { websiteURL, isExternalURL, canNavigate } = require('./url-policy.cjs');

// Packaging embeds the website URL; development defaults to the Vite server.
const site = websiteURL(app.isPackaged
  ? require('./package.json').buildxUrl
  : process.env.BUILDX_DESKTOP_URL || 'http://localhost:5173', !app.isPackaged);
let window;

async function openExternal(url) {
  if (!isExternalURL(url) || !window || window.isDestroyed()) return;
  const { response } = await dialog.showMessageBox(window, {
    type: 'question', buttons: ['Cancel', 'Open browser'], defaultId: 0, cancelId: 0,
    message: 'Open this link in your browser?', detail: url,
  });
  if (response === 1) await shell.openExternal(url).catch(() => {});
}

function createWindow() {
  window = new BrowserWindow({
    title: 'BuildX', width: 1400, height: 900, minWidth: 800, minHeight: 600,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false,
    },
  });

  // No preload or IPC: the website cannot access Node or native system APIs.
  const contents = window.webContents;
  // A simple marker lets the shared website omit installer controls in this app.
  contents.setUserAgent(`${contents.getUserAgent()} BuildXDesktop/${app.getVersion()}`);
  contents.session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'clipboard-sanitized-write' && details.requestingUrl?.startsWith(site.origin + '/'));
  });
  contents.session.setPermissionCheckHandler((_contents, permission, origin) =>
    permission === 'clipboard-sanitized-write' && origin === site.origin);

  const guardNavigation = (event) => {
    if (event.isMainFrame && !canNavigate(event.url, site)) {
      event.preventDefault();
      void openExternal(event.url);
    }
  };
  contents.on('will-navigate', guardNavigation);
  contents.on('will-redirect', guardNavigation);
  contents.setWindowOpenHandler(({ url }) => {
    void openExternal(url);
    return { action: 'deny' };
  });

  // Honor the existing editor's beforeunload protection instead of losing edits.
  contents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(window, {
      type: 'warning', buttons: ['Keep editing', 'Leave'], defaultId: 0, cancelId: 0,
      message: 'There are unsaved changes.', detail: 'Leaving may discard pending edits.',
    });
    if (choice === 1) event.preventDefault();
  });
  window.on('closed', () => { window = null; });
  void loadWebsite();
}

async function loadWebsite() {
  try { await window.loadURL(site.href); }
  catch (error) {
    if (!window || window.isDestroyed() || error.code === 'ERR_ABORTED') return;
    const { response } = await dialog.showMessageBox(window, {
      type: 'error', buttons: ['Retry', 'Close'], defaultId: 0, cancelId: 1,
      message: 'BuildX could not connect.',
      detail: `Check your internet connection and that the website is running.\n${site.href}`,
    });
    if (response === 0) void loadWebsite();
    else window?.close();
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' },
    { label: 'View', submenu: [
      { role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : []),
    ] },
    { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
