import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  X, Rocket, Github, Archive, ExternalLink, Check,
  Loader2, Globe, Copy, AlertCircle, LogIn,
} from 'lucide-react';
import {
  exportBlueprintToGithub,
  downloadBlueprintZip,
  createBlueprintPreviewLink,
} from '../lib/api';
import { useVFS } from '../context/VFSContext';
import type { Blueprint } from '../lib/types';
import { startGithubOAuth } from '../lib/utils';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  blueprintId?: string;
  appName?: string;
  blueprint?: Blueprint;
}

type DeployTarget = 'sandbox' | 'github' | 'zip';

interface TargetConfig {
  id: DeployTarget;
  icon: React.ReactNode;
  label: string;
  description: string;
  cta: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
}

const TARGETS: TargetConfig[] = [
  {
    id: 'sandbox',
    icon: <Globe size={18} />,
    label: 'Deploy to Live Sandbox',
    description: 'Generate instant sandbox link powered by BuildX preview engine.',
    cta: 'Open Live Sandbox',
    accentColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10 hover:bg-emerald-500/15',
    borderColor: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
  {
    id: 'github',
    icon: <Github size={18} />,
    label: 'Push to GitHub',
    description: 'Commit code directly to your connected GitHub account with a single click.',
    cta: 'Push to GitHub',
    accentColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10 hover:bg-indigo-500/15',
    borderColor: 'border-indigo-500/20 hover:border-indigo-500/40',
  },
  {
    id: 'zip',
    icon: <Archive size={18} />,
    label: 'Download Monorepo ZIP',
    description: 'Export complete source code with zero-config Vite + React workspace.',
    cta: 'Download ZIP',
    accentColor: 'text-purple-400',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/15',
    borderColor: 'border-purple-500/20 hover:border-purple-500/40',
  },
];

export function DeployModal({ isOpen, onClose, blueprintId, appName, blueprint }: DeployModalProps) {
  const vfs = useVFS();
  const [selected, setSelected] = useState<DeployTarget | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [requireGithubAuth, setRequireGithubAuth] = useState(false);

  async function handleDeploy() {
    if (!selected) return;
    setIsDeploying(true);
    setDeployError(null);
    setRequireGithubAuth(false);

    try {
      if (selected === 'sandbox') {
        const previewUrl = blueprintId
          ? await createBlueprintPreviewLink(blueprintId)
          : `${window.location.origin}/blueprint/${blueprintId || 'demo'}`;
        setDeploymentUrl(previewUrl);
        setDeploySuccess(true);
      } else if (selected === 'github') {
        const bpSpec: Blueprint = blueprint || {
          appName: appName || 'BuildX Scaffold',
          description: 'AI Generated Monorepo Scaffold',
          targetUsers: 'Developers',
          complexity: 'Medium',
          features: { authentication: [], core: [], admin: [], optional: [] },
          schema: [],
          endpoints: [],
          screens: [],
          architecture: { frontend: 'React + TypeScript', backend: 'Node.js + Express', database: 'PostgreSQL', auth: 'JWT', hosting: 'Vercel', flow: 'Client -> Server' },
          code: { frontend: '', backend: '', sql: '' },
          effort: { time: '1 Week', complexity: 'Medium', cost: '$1,000', team: '1 Engineer' },
        };
        const result = await exportBlueprintToGithub(bpSpec, blueprintId);
        setDeploymentUrl(result.repoUrl);
        setDeploySuccess(true);
      } else if (selected === 'zip') {
        const vfsFiles = vfs.files || {};
        const vfsEntries = Object.entries(vfsFiles).filter(([p]) => p !== 'preview.html');

        if (vfsEntries.length > 0) {
          const zip = new JSZip();
          const cleanAppName = (appName || blueprint?.appName || 'buildx-app')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

          // Add all VFS files to the zip
          for (const [filePath, content] of vfsEntries) {
            zip.file(filePath, content);
          }

          // Ensure root package.json exists if not in VFS
          const hasPackageJson = vfsEntries.some(([p]) => p === 'package.json' || p === 'frontend/package.json');
          if (!hasPackageJson) {
            zip.file('package.json', JSON.stringify({
              name: cleanAppName,
              private: true,
              version: '1.0.0',
              type: 'module',
              scripts: {
                dev: 'vite',
                build: 'tsc && vite build',
                preview: 'vite preview',
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
                'lucide-react': '^0.294.0',
                'framer-motion': '^12.43.0',
                clsx: '^2.1.1',
                'tailwind-merge': '^3.6.0',
              },
              devDependencies: {
                '@types/react': '^18.2.43',
                '@types/react-dom': '^18.2.17',
                '@vitejs/plugin-react': '^4.2.1',
                autoprefixer: '^10.4.16',
                postcss: '^8.4.32',
                tailwindcss: '^3.3.6',
                typescript: '^5.3.2',
                vite: '^5.0.0',
              },
            }, null, 2));
          }

          // Ensure vite.config.ts exists
          const hasViteConfig = vfsEntries.some(([p]) => p === 'vite.config.ts' || p === 'frontend/vite.config.ts');
          if (!hasViteConfig) {
            zip.file('vite.config.ts', `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n});\n`);
          }

          // Ensure index.html exists
          const hasIndexHtml = vfsEntries.some(([p]) => p === 'index.html' || p === 'frontend/index.html');
          if (!hasIndexHtml) {
            zip.file('index.html', `<!DOCTYPE html>\n<html lang="en" class="dark">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${appName || blueprint?.appName || 'App'}</title>\n  </head>\n  <body class="bg-[#09090b] text-zinc-100 min-h-screen">\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>\n`);
          }

          // Ensure README.md exists
          if (!vfsFiles['README.md']) {
            zip.file('README.md', `# ${appName || blueprint?.appName || 'BuildX Application'}\n\nGenerated with BuildX AI Development Platform.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`);
          }

          const blob = await zip.generateAsync({ type: 'blob' });
          saveAs(blob, `${cleanAppName}.zip`);
          setDeploySuccess(true);
        } else {
          await downloadBlueprintZip(blueprintId, blueprint);
          setDeploySuccess(true);
        }
      }
    } catch (err: any) {
      console.error('[DeployModal] Deploy error:', err);
      if (err.require_github_auth) {
        setRequireGithubAuth(true);
      }
      setDeployError(err.message || 'Deployment failed. Please try again.');
    } finally {
      setIsDeploying(false);
    }
  }

  function handleCopy() {
    if (!deploymentUrl) return;
    navigator.clipboard.writeText(deploymentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleGithubConnect() {
    startGithubOAuth('link', window.location.pathname + window.location.search);
  }

  function handleClose() {
    onClose();
    // Reset after exit animation
    setTimeout(() => {
      setSelected(null);
      setIsDeploying(false);
      setDeploySuccess(false);
      setDeploymentUrl('');
      setCopied(false);
      setDeployError(null);
      setRequireGithubAuth(false);
    }, 300);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="deploy-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleClose}
            className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Panel */}
          <motion.div
            key="deploy-modal"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-lg bg-[#111116] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden">

              {/* Ambient top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[120px] bg-indigo-500/10 blur-[80px] pointer-events-none rounded-full" />

              {/* Header Rail */}
              <div className="relative flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.07]">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                    00 / DEPLOYMENT CENTER
                  </span>
                  <h2 className="text-base font-bold text-white tracking-tight font-sans">
                    Choose Deployment Target
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white transition-all font-sans"
                  aria-label="Close modal"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <div className="relative p-6 space-y-3 font-sans">

                {/* Success state */}
                <AnimatePresence mode="wait">
                  {deploySuccess ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-4 py-6 text-center"
                    >
                      <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                        <Check className="text-emerald-400" size={24} />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm font-sans">Deployment successful!</p>
                        <p className="text-zinc-400 text-xs mt-1 font-sans">
                          {selected === 'zip'
                            ? 'Your ZIP archive is downloading...'
                            : 'Your deployment is live and ready.'}
                        </p>
                      </div>
                      {deploymentUrl && (
                        <div className="w-full flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl font-mono text-xs text-zinc-300">
                          <span className="flex-1 truncate">{deploymentUrl}</span>
                          <button
                            onClick={handleCopy}
                            className="shrink-0 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                            title="Copy URL"
                          >
                            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <a
                            href={deploymentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      )}
                      <button
                        onClick={handleClose}
                        className="mt-2 px-5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-zinc-300 hover:text-white transition-all font-medium font-sans"
                      >
                        Done
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div key="options" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                      {deployError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-xs text-red-400 font-mono">
                          <AlertCircle size={15} className="shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p>{deployError}</p>
                            {requireGithubAuth && (
                              <button
                                type="button"
                                onClick={handleGithubConnect}
                                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white font-medium text-xs font-sans transition-colors"
                              >
                                <LogIn size={13} />
                                <span>Connect GitHub Account</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Target options */}
                      <div className="space-y-2.5">
                        {TARGETS.map((target) => (
                          <button
                            key={target.id}
                            onClick={() => setSelected(target.id)}
                            className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                              selected === target.id
                                ? `${target.bgColor} ${target.borderColor}`
                                : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.07] hover:border-white/15'
                            }`}
                          >
                            <div className={`mt-0.5 shrink-0 ${selected === target.id ? target.accentColor : 'text-zinc-500'} transition-colors`}>
                              {target.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-semibold transition-colors font-sans ${selected === target.id ? 'text-white' : 'text-zinc-300'}`}>
                                {target.label}
                              </p>
                              <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed font-sans">
                                {target.description}
                              </p>
                            </div>
                            <div className={`mt-1 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              selected === target.id
                                ? `${target.borderColor.split(' ')[0].replace('border-', 'border-')} bg-current`
                                : 'border-white/20'
                            }`}>
                              {selected === target.id && (
                                <motion.div
                                  layoutId="deploy-radio"
                                  className={`w-2 h-2 rounded-full ${target.accentColor.replace('text-', 'bg-')}`}
                                />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer CTA */}
              {!deploySuccess && (
                <div className="px-6 pb-6">
                  <motion.button
                    whileHover={{ scale: selected && !isDeploying ? 1.01 : 1 }}
                    whileTap={{ scale: selected && !isDeploying ? 0.98 : 1 }}
                    onClick={handleDeploy}
                    disabled={!selected || isDeploying}
                    className={`w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold font-sans transition-all border ${
                      selected && !isDeploying
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-400/30 shadow-lg shadow-indigo-500/20'
                        : 'bg-white/[0.04] text-zinc-500 border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {isDeploying ? (
                      <>
                        <Loader2 className="animate-spin" size={15} />
                        <span>Deploying…</span>
                      </>
                    ) : (
                      <>
                        <Rocket size={15} />
                        <span>
                          {selected
                            ? TARGETS.find(t => t.id === selected)?.cta
                            : 'Select a target above'}
                        </span>
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
