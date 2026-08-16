import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AmbientBackground } from './AmbientBackground';
import { Logo } from './Logo';
import { PageHead } from './PageHead';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, AlertTriangle, ArrowRight } from 'lucide-react';

interface SyncStep {
  id: string;
  label: string;
  status: 'done' | 'active' | 'pending';
}

const INITIAL_STEPS: SyncStep[] = [
  { id: 'oauth',    label: 'Validate OAuth 2.0 state',         status: 'done'    },
  { id: 'exchange', label: 'Exchange authorization code',      status: 'active'  },
  { id: 'token',    label: 'Provision access token',           status: 'pending' },
  { id: 'session',  label: 'Initialize BuildX workspace',      status: 'pending' },
];

export function GithubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loginWithGithub, linkGithub } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [steps, setSteps] = useState<SyncStep[]>(INITIAL_STEPS);

  // Progress steps forward as auth runs
  function advanceStep(id: string) {
    setSteps(prev =>
      prev.map((s, i, arr) => {
        if (s.id === id) return { ...s, status: 'active' };
        const prevDone = arr.slice(0, i).every(p => p.status === 'done');
        if (prevDone && s.status === 'active') return { ...s, status: 'done' };
        return s;
      })
    );
  }

  function completeAllSteps() {
    setSteps(prev => prev.map(s => ({ ...s, status: 'done' })));
  }

  useEffect(() => {
    const code = searchParams.get('code');
    const returnedState = searchParams.get('state');
    const expectedState = sessionStorage.getItem('buildx_github_oauth_state');

    if (!returnedState || returnedState !== expectedState) {
      sessionStorage.removeItem('buildx_github_oauth_state');
      setErrorMsg('GitHub session validation failed. Please try again.');
      return;
    }
    sessionStorage.removeItem('buildx_github_oauth_state');

    if (!code) {
      setErrorMsg('No authorization code received from GitHub.');
      return;
    }

    const doneKey = `buildx_github_done_${code}`;
    const lockKey = `buildx_github_lock_${code}`;
    const redirectPath = sessionStorage.getItem('buildx_auth_redirect') || '/create';

    if (sessionStorage.getItem(doneKey)) {
      sessionStorage.removeItem('buildx_auth_redirect');
      navigate(redirectPath, { replace: true });
      return;
    }

    if (sessionStorage.getItem(lockKey)) return;
    sessionStorage.setItem(lockKey, '1');

    const isLinkMode = sessionStorage.getItem('buildx_github_link') === 'true';
    const canLink = Boolean(user);

    async function processLogin() {
      try {
        advanceStep('token');
        if (isLinkMode && canLink) {
          await linkGithub(code!);
          sessionStorage.removeItem('buildx_github_link');
        } else {
          sessionStorage.removeItem('buildx_github_link');
          await loginWithGithub(code!);
        }
        advanceStep('session');
        completeAllSteps();

        await new Promise(r => setTimeout(r, 400)); // let animation finish
        sessionStorage.setItem(doneKey, '1');
        sessionStorage.removeItem('buildx_auth_redirect');
        navigate(redirectPath, { replace: true });
      } catch (err) {
        sessionStorage.removeItem(lockKey);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to authenticate with GitHub.');
      }
    }

    void processLogin();
  }, [searchParams, loginWithGithub, linkGithub, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 bg-obsidian-bg">
      <PageHead title="Authenticating with GitHub — BuildX" description="Processing your GitHub OAuth session" />
      <AmbientBackground />

      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-sylven/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-72 h-72 rounded-full bg-emerald-600/8 blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="rounded-3xl border border-obsidian-border bg-obsidian-surface/95 shadow-2xl backdrop-blur-2xl overflow-hidden">
          {/* Header stripe */}
          <div className="px-8 pt-8 pb-6 border-b border-obsidian-borderSubtle">
            <div className="flex justify-center mb-5">
              <Logo size="lg" />
            </div>
            <p className="text-center text-[10px] font-mono tracking-widest text-norvin-muted uppercase">
              00 / AUTHENTICATION
            </p>
          </div>

          <div className="px-8 py-7">
            <AnimatePresence mode="wait">
              {errorMsg ? (
                /* ── Error State ── */
                <motion.div
                  key="error"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center space-y-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 inline-flex items-center justify-center text-red-400 mx-auto">
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <h2 className="font-display font-extrabold text-xl text-red-400 mb-1">
                      Authentication Failed
                    </h2>
                    <p className="font-mono text-xs text-neutral-500 leading-relaxed">{errorMsg}</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/login', { replace: true })}
                    className="landing-btn landing-btn--primary mx-auto"
                  >
                    <span>Back to Login</span>
                    <ArrowRight size={14} className="landing-btn__icon" />
                  </motion.button>
                </motion.div>
              ) : (
                /* ── Syncing State ── */
                <motion.div key="syncing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-7">
                  {/* Node Connection Graphic: BUILDX <---> GITHUB */}
                  <div className="flex items-center justify-center gap-4">
                    {/* BuildX node */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-2xl bg-sylven/15 border border-sylven/30 inline-flex items-center justify-center">
                        <Logo size="sm" />
                      </div>
                      <span className="text-[9px] font-mono text-norvin-muted uppercase tracking-widest">BUILDX</span>
                    </div>

                    {/* Animated connection line */}
                    <div className="flex-1 flex items-center gap-0.5 relative h-4">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <motion.span
                          key={i}
                          className="flex-1 h-px bg-sylven/40 rounded-full"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>

                    {/* GitHub node */}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-10 h-10 rounded-2xl bg-white/[0.06] border border-white/[0.12] inline-flex items-center justify-center">
                        <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24" aria-label="GitHub">
                          <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-mono text-norvin-muted uppercase tracking-widest">GITHUB</span>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center">
                    <h2 className="font-display font-extrabold text-lg text-white">Connecting GitHub Session</h2>
                    <p className="font-mono text-xs text-norvin-muted mt-1">
                      Authenticating OAuth token &amp; provisioning workspace…
                    </p>
                  </div>

                  {/* Live Monospace Sync Terminal */}
                  <div className="p-4 rounded-xl bg-obsidian-panel border border-obsidian-border font-mono text-[11px] space-y-2.5">
                    {steps.map((step) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between"
                      >
                        <span className={`flex items-center gap-2 ${
                          step.status === 'done'    ? 'text-sylven-light' :
                          step.status === 'active'  ? 'text-sylven-light'  :
                          'text-neutral-600'
                        }`}>
                          {step.status === 'done' ? (
                            <Check size={11} className="flex-shrink-0 text-sylven-light" />
                          ) : step.status === 'active' ? (
                            <motion.span
                              className="w-2 h-2 rounded-full bg-sylven-light flex-shrink-0"
                              animate={{ opacity: [1, 0.3, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                            />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-neutral-700 flex-shrink-0" />
                          )}
                          {step.label}
                        </span>
                        <span className={`text-[9px] uppercase tracking-widest ${
                          step.status === 'done'   ? 'text-sylven' :
                          step.status === 'active' ? 'text-sylven-light'  :
                          'text-neutral-700'
                        }`}>
                          {step.status === 'done' ? 'OK' : step.status === 'active' ? 'Active' : '—'}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
