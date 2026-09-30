# BuildX desktop

This is a small Electron wrapper around the existing BuildX website. It does not
bundle the backend, database, AI keys or Docker. Internet access is required.

## Run locally

From the repository root, install dependencies with `npm ci`, then run `npm run dev`.
In another terminal run:

```sh
npm run desktop:dev
```

Electron opens `http://localhost:5173`. To open the deployed website instead:

```sh
BUILDX_DESKTOP_URL=https://my-buildx.vercel.app npm run desktop:dev
```

On PowerShell, set `$env:BUILDX_DESKTOP_URL = 'https://my-buildx.vercel.app'`
before running the npm command.

## Build installers

The verified website URL in `desktop/package.json` gets embedded in the installed app.
An installed app does not depend on environment variables or a local Node server.

```sh
npm run desktop:package -- --mac
```

On Windows PowerShell:

```powershell
npm run desktop:package -- --win
```

Build macOS on a Mac and Windows on Windows. Outputs are in `desktop/dist/`:

- `BuildX-0.1.0-mac-universal.dmg`: Apple Silicon and Intel Macs.
- `BuildX-0.1.0-win-x64.exe`: Windows x64, with a normal setup wizard.

These commands create development installers. The macOS build uses ad-hoc signing;
it is not a notarized public distribution. Windows builds have no publisher
signature unless signing credentials are supplied. The initial app uses Electron's
default installer icon. Native Windows ARM64 and automatic updates are not included.

## Release and website downloads

1. Deploy the website changes and verify the hosted frontend/API.
2. Open GitHub Actions → **Desktop installers** → **Run workflow**. Enter the real
   HTTPS website URL. Leave **create_release** off for internal test artifacts.
3. For a public release candidate, configure repository secrets:
   `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` (Developer ID certificate), `APPLE_ID`,
   `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (notarization), and `WIN_CSC_LINK`,
   `WIN_CSC_KEY_PASSWORD` (a CI-compatible Windows signing certificate).
   Certificate links may be base64-encoded certificates. Never commit credentials.
4. Run the workflow with **create_release** enabled. It runs application checks,
   creates signed installers, notarizes macOS, installs and launches both apps,
   checks that download controls and Node access are absent, and creates a **draft** release.
5. Download and test both installers on clean machines: launch, email login,
   GitHub login/linking, preview, ZIP export, external links, quit with unsaved edits,
   and reopen. Test macOS on Apple Silicon and Intel. Account-backed GitHub login
   is a release gate; some provider/SSO configurations may reject embedded browsers.
6. Publish the draft after those checks pass. The website's **Download Desktop**
   modal reads published `desktop-vX.Y.Z` installer links from
   `frontend/public/desktop-releases.json`. The **Update desktop download links**
   workflow verifies both release assets and commits their metadata, triggering
   Vercel deployment. It enables each platform only when its installer is present.

The repository/release assets must be public. No GitHub token is sent from the UI,
and downloading does not depend on GitHub's API rate limit. Outages show a retry
and a link to the release page. Draft and
prerelease files are not advertised. Bump `desktop/package.json` before the next
release; tags and filenames must retain the documented format. Users update by
downloading a newer installer; website changes appear without repackaging Electron.
Packaging does not remove the existing hosted-service staging/release gates.

## Explain it in a viva

- **Electron** provides Chromium to display BuildX and Node.js for the main process.
- **`main.cjs`** creates the window, loads the website, provides native menus, and
  handles connection failures, external links and unsaved-edit prompts.
- **`url-policy.cjs`** accepts only the intended website/GitHub navigation and HTTPS
  external links. The installed website URL must use HTTPS.
- **`electron-builder.cjs`** describes the application and installer formats.
- **DesktopDownload** is a React button and modal that reads published GitHub
  release metadata served by the website and links to the installers. The Electron window adds a
  `BuildXDesktop` user-agent marker. React uses that marker to omit the entire
  download component inside the desktop app, including its dialog and links.
- The website runs with Node access disabled and Electron's isolation/sandbox
  enabled. There is no preload script or IPC bridge because we need no native APIs
  inside React. AI, storage and authentication remain in the existing backend.

Run `npm run desktop:test` for navigation-policy regression checks. Packaging and
local tests do not establish that signed installation or live OAuth has passed.
