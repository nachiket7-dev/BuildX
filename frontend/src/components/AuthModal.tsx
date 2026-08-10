import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { generateOAuthState } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { modalBackdrop, modalPanel } from '../lib/motion';
import { Logo } from './Logo';
import { Github, Lock, Mail, User as UserIcon, X, Shield, Eye, EyeOff, ArrowRight } from 'lucide-react';

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(name, email, password);
      }
      setName('');
      setEmail('');
      setPassword('');
      onClose();
    } catch {
      // Error handled by hook
    }
  }

  function switchTab(newTab: AuthTab) {
    setTab(newTab);
    clearError();
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={modalBackdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-xl"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className="relative w-full max-w-md my-auto rounded-3xl border border-white/10 p-6 sm:p-8 bg-[#121216]/95 backdrop-blur-2xl shadow-2xl overflow-hidden text-white"
          >
            {/* Ambient Background Glows */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
            >
              <X size={15} />
            </button>

            {/* Logo & Heading */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <Logo size="lg" />
              </div>
              <h2 className="font-display font-extrabold text-xl text-white">
                {tab === 'login' ? 'Welcome Back to BuildX' : 'Create Your Account'}
              </h2>
              <p className="font-mono text-xs text-zinc-400 mt-1">
                {tab === 'login'
                  ? 'Sign in to access your AI-generated workspaces'
                  : 'Start architecting monorepos with multi-model AI'}
              </p>
            </div>

            {/* Emerald Status Tag Badge */}
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-400/90 border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                00 / JWT AUTHENTICATION
              </span>
            </div>

            {/* Gliding Tab Indicator */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-950 border border-white/10 mb-6 relative font-mono text-xs" role="tablist">
              {(['login', 'signup'] as AuthTab[]).map((t, idx) => {
                const num = String(idx + 1).padStart(2, '0');
                const label = t === 'login' ? 'Sign in' : 'Sign up';
                const isActive = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => switchTab(t)}
                    className={`relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10 flex items-center justify-center gap-1.5 ${
                      isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="authModalTabIndicator"
                        className="absolute inset-0 rounded-lg bg-indigo-600/30 border border-indigo-500/40 shadow-sm"
                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">{num}</span>
                      <span>{label}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-xl p-3 mb-4 text-xs font-mono bg-red-950/40 text-red-300 border border-red-500/30"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <AnimatePresence>
                {tab === 'signup' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 block">
                        01 / FULL NAME
                      </label>
                      <div className="relative">
                        <UserIcon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Jane Doe"
                          required
                          minLength={2}
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/80 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 text-sm text-white placeholder:text-zinc-600 focus:outline-none font-mono transition-all"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  {tab === 'signup' ? '02 / EMAIL ADDRESS' : '01 / EMAIL ADDRESS'}
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/80 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 text-sm text-white placeholder:text-zinc-600 focus:outline-none font-mono transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-[10px] uppercase tracking-wider text-zinc-400 mb-1.5 block">
                  {tab === 'signup' ? '03 / PASSWORD' : '02 / PASSWORD'}
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-12 py-3 rounded-xl bg-zinc-950/80 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 text-sm text-white placeholder:text-zinc-600 focus:outline-none font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Signature Electric Indigo Primary CTA Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium py-3 rounded-xl text-sm transition-all shadow-lg shadow-indigo-500/25 border border-indigo-400/30 flex items-center justify-center gap-2 mt-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2 font-mono text-xs">
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {tab === 'login' ? 'Signing in…' : 'Creating account…'}
                  </span>
                ) : (
                  <>
                    <span>{tab === 'login' ? 'Sign in to Studio' : 'Create free account'}</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </motion.button>
            </form>

            <div className="my-5 flex items-center justify-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">or</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            {/* Secondary GitHub Button */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={() => {
                const redirectFrom = window.location.pathname === '/login' || window.location.pathname === '/'
                  ? '/create'
                  : `${window.location.pathname}${window.location.search}${window.location.hash}`;
                sessionStorage.setItem('buildx_auth_redirect', redirectFrom);
                sessionStorage.removeItem('buildx_github_link');
                const state = generateOAuthState();
                sessionStorage.setItem('buildx_github_oauth_state', state);
                const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || '';
                const redirectUri = encodeURIComponent(window.location.origin + '/login/callback');
                window.location.href = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email,repo&redirect_uri=${redirectUri}&state=${state}`;
              }}
              className="w-full bg-zinc-900/90 border border-white/10 hover:border-white/25 text-white rounded-xl py-3 text-sm font-medium transition-all flex items-center justify-center gap-2.5"
            >
              <Github size={16} />
              <span>Continue with GitHub</span>
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
