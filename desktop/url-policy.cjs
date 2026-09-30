// The installed app always uses HTTPS. HTTP is only for local development.
function websiteURL(value, development = false) {
  if (!value) throw new Error('Set BUILDX_DESKTOP_URL to the HTTPS BuildX website URL before packaging.');
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.hash || url.search ||
      !(url.protocol === 'https:' || (development && local && url.protocol === 'http:'))) {
    throw new Error('Set BUILDX_DESKTOP_URL to the HTTPS BuildX website URL.');
  }
  return url;
}

function isExternalURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

function canNavigate(value, website) {
  try {
    const url = new URL(value);
    // GitHub stays in this window so the existing OAuth state/session survives.
    return !url.username && !url.password &&
      (url.origin === website.origin || url.origin === 'https://github.com');
  } catch { return false; }
}

module.exports = { websiteURL, isExternalURL, canNavigate };
