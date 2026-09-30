const { websiteURL } = require('./url-policy.cjs');
const url = websiteURL(process.env.BUILDX_DESKTOP_URL || require('./package.json').buildxUrl).href;
const signed = process.env.BUILDX_SIGNED_RELEASE === 'true';

module.exports = {
  appId: 'dev.buildx.desktop', productName: 'BuildX',
  directories: { output: 'dist', buildResources: 'assets' },
  icon: 'assets/icon.svg',
  files: ['main.cjs', 'url-policy.cjs', 'package.json', 'assets/icon.png'],
  extraMetadata: { buildxUrl: url },
  artifactName: 'BuildX-${version}-${os}-${arch}.${ext}',
  forceCodeSigning: signed,
  mac: {
    target: [{ target: 'dmg', arch: ['universal'] }],
    category: 'public.app-category.developer-tools',
    hardenedRuntime: signed, notarize: signed,
    identity: signed ? undefined : '-',
  },
  win: { target: [{ target: 'nsis', arch: ['x64'] }] },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true },
};
