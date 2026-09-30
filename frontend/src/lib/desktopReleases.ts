const REPOSITORY = 'nachiket7-dev/BuildX';
export const DESKTOP_RELEASES_URL = `https://github.com/${REPOSITORY}/releases`;

export interface DesktopRelease {
  version: string;
  mac?: { url: string; size: number };
  windows?: { url: string; size: number };
}

// Only published desktop releases and assets from our own repository are offered.
export function parseDesktopRelease(releases: unknown): DesktopRelease | null {
  if (!Array.isArray(releases)) throw new Error('Invalid release response');
  const release = releases.find((item) => item && !item.draft && !item.prerelease &&
    typeof item.tag_name === 'string' && /^desktop-v\d+\.\d+\.\d+$/.test(item.tag_name));
  if (!release) return null;
  const asset = (suffix: string) => {
    if (!Array.isArray(release.assets)) return undefined;
    const file = release.assets.find((item: Record<string, unknown>) =>
      item && typeof item.name === 'string' && item.name.startsWith('BuildX-') && item.name.endsWith(suffix) &&
      item.state === 'uploaded' && typeof item.size === 'number' && item.size > 0 &&
      typeof item.browser_download_url === 'string' &&
      item.browser_download_url.startsWith(`${DESKTOP_RELEASES_URL}/download/${release.tag_name}/`));
    return file ? { url: file.browser_download_url as string, size: file.size as number } : undefined;
  };
  return { version: release.tag_name.slice('desktop-v'.length),
    mac: asset('-mac-universal.dmg'), windows: asset('-win-x64.exe') };
}

export async function fetchDesktopRelease(signal: AbortSignal): Promise<DesktopRelease | null> {
  // Published release metadata is served by our website, avoiding GitHub API limits.
  const response = await fetch('/desktop-releases.json', {
    cache: 'no-cache', signal,
  });
  if (!response.ok) throw new Error('Could not check desktop downloads. Please try again or open the release page.');
  return parseDesktopRelease(await response.json());
}
