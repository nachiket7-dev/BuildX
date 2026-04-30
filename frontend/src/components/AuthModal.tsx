import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthTab = 'login' | 'signup';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup, isLoading, error, clearError } = useAuth();

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      // Success — close modal
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    } catch {
      // Error is handled by the hook
    }
  }

  function switchTab(newTab: AuthTab) {
    setTab(newTab);
    clearError();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 overflow-y-auto py-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md my-auto rounded-2xl border p-6 sm:p-8 animate-fade-slide-up"
        style={{
          background: 'var(--surface)',
          borderColor: 'rgba(124, 106, 255, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: 'var(--text3)' }}
        >
          ✕
        </button>

        {/* Logo */}
        <div className="text-center mb-6">
          <h2 className="font-display font-extrabold text-xl" style={{ color: 'var(--text)' }}>
            {tab === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p className="font-mono-custom text-xs mt-1" style={{ color: 'var(--text3)' }}>
            {tab === 'login'
              ? 'Sign in to access your blueprints'
              : 'Start building with BuildX'}
          </p>
        </div>

        {/* Tab toggle */}
        <div
          className="flex rounded-xl p-1 mb-6"
          style={{ background: 'var(--surface2)' }}
        >
          {(['login', 'signup'] as AuthTab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className="flex-1 py-2 rounded-lg font-mono-custom text-xs font-medium transition-all duration-150"
              style={{
                background: tab === t ? 'var(--accent-glow)' : 'transparent',
                color: tab === t ? 'var(--accent2)' : 'var(--text3)',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div
            className="rounded-lg p-3 mb-4 text-xs font-mono-custom"
            style={{
              background: 'var(--coral-dim)',
              color: 'var(--coral)',
              border: '1px solid rgba(248,113,113,0.2)',
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {tab === 'signup' && (
            <div>
              <label
                className="font-mono-custom text-[10px] uppercase tracking-wider mb-1.5 block"
                style={{ color: 'var(--text3)' }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                minLength={2}
                className="w-full px-4 py-2.5 rounded-xl border text-sm transition-all duration-150"
                style={{
                  background: 'var(--surface2)',
                  borderColor: 'var(--border2)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                onFocus={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(124,106,255,0.4)'; }}
                onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border2)'; }}
              />
            </div>
          )}

          <div>
            <label
              className="font-mono-custom text-[10px] uppercase tracking-wider mb-1.5 block"
              style={{ color: 'var(--text3)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full px-4 py-2.5 rounded-xl border text-sm transition-all duration-150"
              style={{
                background: 'var(--surface2)',
                borderColor: 'var(--border2)',
                color: 'var(--text)',
                outline: 'none',
              }}
              onFocus={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(124,106,255,0.4)'; }}
              onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border2)'; }}
            />
          </div>

          <div>
            <label
              className="font-mono-custom text-[10px] uppercase tracking-wider mb-1.5 block"
              style={{ color: 'var(--text3)' }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                className="w-full px-4 py-2.5 pr-11 rounded-xl border text-sm transition-all duration-150"
                style={{
                  background: 'var(--surface2)',
                  borderColor: 'var(--border2)',
                  color: 'var(--text)',
                  outline: 'none',
                }}
                onFocus={(e) => { (e.target as HTMLElement).style.borderColor = 'rgba(124,106,255,0.4)'; }}
                onBlur={(e) => { (e.target as HTMLElement).style.borderColor = 'var(--border2)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors"
                style={{ color: 'var(--text3)' }}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full py-3 rounded-xl font-display font-semibold text-sm text-white transition-all duration-200 disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              boxShadow: '0 0 20px var(--accent-glow)',
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin-slow" />
                {tab === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              tab === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
