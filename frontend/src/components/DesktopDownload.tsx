import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, ArrowUpRight } from './ui/icons';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { DESKTOP_RELEASES_URL, fetchDesktopRelease } from '../lib/desktopReleases';
import { isDesktopApp } from '../lib/platform';

export function DesktopDownload() {
  // Do not mount the button, dialog or release query inside the desktop app.
  return isDesktopApp() ? null : <WebDesktopDownload />;
}

function WebDesktopDownload() {
  const [open, setOpen] = useState(false);
  const release = useQuery({
    queryKey: ['desktop-release'],
    queryFn: ({ signal }) => fetchDesktopRelease(signal),
    enabled: open, staleTime: 5 * 60 * 1000, retry: false,
  });
  const platform = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const recommended = /Windows/i.test(platform) ? 'windows' : /Macintosh/i.test(platform) ? 'mac' : '';
  const options = [
    { id: 'mac' as const, title: 'macOS', detail: 'Apple Silicon and Intel · DMG' },
    { id: 'windows' as const, title: 'Windows', detail: '64-bit Intel / AMD · EXE installer' },
  ];

  return <>
    <Button onClick={() => setOpen(true)} icon={<Download size={15} />}>
      Download Desktop
    </Button>
    <Modal isOpen={open} onClose={() => setOpen(false)} title="BuildX for desktop"
      description="Your BuildX workspace in a desktop window. Internet access is required.">
      {release.isLoading && <p className="text-sm text-zinc-400" role="status">Checking available downloads…</p>}
      {release.isError && <div role="alert" className="space-y-3">
        <p className="text-sm text-zinc-400">{release.error instanceof Error ? release.error.message : 'Downloads are temporarily unavailable.'}</p>
        <Button onClick={() => void release.refetch()} loading={release.isFetching}>Try again</Button>
      </div>}
      {release.isSuccess &&
        <p className="mb-4 text-sm text-zinc-400" role="status">
          {release.data ? `Version ${release.data.version}` : 'Desktop installers have not been published yet.'}
        </p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {options.map(({ id, title, detail }) => {
            const asset = release.data?.[id];
            return <div key={id} className="space-y-3 rounded-xl border border-slate-800 bg-zinc-900 p-4">
              <p className="font-semibold">{title}{recommended === id && <span className="ml-2 text-xs text-emerald-400">For your computer</span>}</p>
              <p className="text-xs text-zinc-400">{detail}</p>
              {asset ? <a href={asset.url} className="ui-button ui-button--primary w-full">
                <Download size={15} /> Download · {(asset.size / 1024 / 1024).toFixed(0)} MB
              </a> : <Button disabled fullWidth>Not available yet</Button>}
              <p className="text-xs text-zinc-400">{id === 'mac'
                ? 'Open the DMG and drag BuildX into Applications.'
                : 'Open the installer and follow the setup steps.'}</p>
            </div>;
          })}
        </div>
      <p className="mt-4 text-xs text-zinc-400">For a newer version, return here and download the latest installer.</p>
      <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-400">
        View releases <ArrowUpRight size={14} />
      </a>
    </Modal>
  </>;
}
