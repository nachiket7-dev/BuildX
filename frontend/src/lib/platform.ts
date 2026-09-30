// Only our wrapper adds this marker; normal browsers keep the download controls.
export function isDesktopApp(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
): boolean {
  return /(?:^|\s)BuildXDesktop\/\S+(?:\s|$)/.test(userAgent);
}
