import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AmbientBackground } from './AmbientBackground';
import { Logo } from './Logo';
import { PageHead } from './PageHead';

export function GithubCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loginWithGithub, linkGithub } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    if (sessionStorage.getItem(lockKey)) {
      return;
    }
    sessionStorage.setItem(lockKey, '1');

    const isLinkMode = sessionStorage.getItem('buildx_github_link') === 'true';
    const canLink = Boolean(user);

    async function processLogin() {
      try {
        if (isLinkMode && canLink) {
          await linkGithub(code!);
          sessionStorage.removeItem('buildx_github_link');
        } else {
          sessionStorage.removeItem('buildx_github_link');
          await loginWithGithub(code!);
        }

        sessionStorage.setItem(doneKey, '1');
        sessionStorage.removeItem('buildx_auth_redirect');
        navigate(redirectPath, { replace: true });
      } catch (err) {
        sessionStorage.removeItem(lockKey);
        console.error('[OAuth Callback] Login error:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to authenticate with GitHub.');
      }
    }

    void processLogin();
  }, [searchParams, loginWithGithub, linkGithub, navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <PageHead title="Authenticating with GitHub..." description="Processing your GitHub session" />
      <AmbientBackground />

      <div
        className="relative z-10 w-full max-w-md rounded-2xl border p-8 text-center animate-fade-slide-up"
        style={{
          background: 'var(--surface)',
          borderColor: 'rgba(20, 184, 166, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>

        {errorMsg ? (
          <div>
            <h2 className="font-display font-extrabold text-xl text-[var(--coral)] mb-3">
              Authentication Failed
            </h2>
            <p className="font-mono-custom text-xs text-[var(--text3)] mb-6 leading-relaxed">
              {errorMsg}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="py-2.5 px-6 rounded-xl font-display font-semibold text-xs text-white transition-all duration-200"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 0 15px var(--accent-glow)',
              }}
            >
              Back to Login
            </button>
          </div>
        ) : (
          <div>
            <div className="flex justify-center mb-6">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <div className="absolute inset-2 rounded-full border border-b-transparent animate-spin-slow" style={{ borderColor: 'var(--accent2)', borderBottomColor: 'transparent' }} />
              </div>
            </div>
            <h2 className="font-display font-extrabold text-lg" style={{ color: 'var(--text)' }}>
              Connecting with GitHub
            </h2>
            <p className="font-mono-custom text-xs mt-2" style={{ color: 'var(--text3)' }}>
              Preparing your blueprint workspace...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
