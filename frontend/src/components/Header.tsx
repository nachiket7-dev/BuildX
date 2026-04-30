import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { AuthModal } from './AuthModal';
import { useAuth } from '../hooks/useAuth';
import { useModel, AVAILABLE_MODELS } from '../hooks/useModel';

interface HeaderProps {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
  sidebarOpen?: boolean;
}

export function Header({ onToggleSidebar, showSidebarToggle, sidebarOpen }: HeaderProps) {
  const location = useLocation();
  const isGallery = location.pathname === '/gallery';
  const { user, logout } = useAuth();
  const { selectedModel } = useModel();
  const [showAuth, setShowAuth] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <header
        className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 sticky top-0 z-50"
        style={{
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
          background: 'rgba(10,10,15,0.75)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Sidebar toggle */}
          {showSidebarToggle && !sidebarOpen && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--text3)' }}
              title="Open sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <Link to="/" style={{ textDecoration: 'none' }}>
            <Logo size="md" />
          </Link>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          {/* Gallery link */}
          <Link
            to="/gallery"
            className="font-mono-custom text-xs transition-colors duration-150"
            style={{
              color: isGallery ? 'var(--accent2)' : 'var(--text3)',
            }}
            onMouseEnter={(e) => {
              if (!isGallery) (e.target as HTMLElement).style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              if (!isGallery) (e.target as HTMLElement).style.color = 'var(--text3)';
            }}
          >
            <span className="hidden sm:inline">Gallery</span>
            <span className="sm:hidden">🖼️</span>
          </Link>

          {/* Status dot */}
          <div className="flex items-center gap-2">
            <div
              className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
              style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }}
            />
            <span className="font-mono-custom text-xs hidden sm:inline" style={{ color: 'var(--text3)' }}>
              {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.label || 'Groq AI'}
            </span>
          </div>

          {/* Auth section */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-150"
                style={{
                  background: 'var(--accent-glow)',
                  borderColor: 'rgba(124,106,255,0.25)',
                  color: 'var(--accent2)',
                }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: 'var(--accent)' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-mono-custom text-xs hidden sm:inline">
                  {user.name}
                </span>
              </button>

              {/* Dropdown */}
              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div
                    className="absolute right-0 top-full mt-2 w-48 rounded-xl border p-2 z-50"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border2)',
                      boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    }}
                  >
                    <div className="px-3 py-2 mb-1">
                      <p className="font-mono-custom text-xs font-medium" style={{ color: 'var(--text)' }}>
                        {user.name}
                      </p>
                      <p className="font-mono-custom text-[10px]" style={{ color: 'var(--text3)' }}>
                        {user.email}
                      </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

                    <Link
                      to="/gallery"
                      onClick={() => setShowMenu(false)}
                      className="block px-3 py-2 rounded-lg font-mono-custom text-xs transition-colors"
                      style={{ color: 'var(--text2)' }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--surface2)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      📋 My Blueprints
                    </Link>

                    <button
                      onClick={() => {
                        logout();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg font-mono-custom text-xs transition-colors"
                      style={{ color: 'var(--coral)' }}
                      onMouseEnter={(e) => {
                        (e.target as HTMLElement).style.background = 'var(--coral-dim)';
                      }}
                      onMouseLeave={(e) => {
                        (e.target as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      ↪ Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-xl border font-mono-custom text-xs transition-all duration-150"
              style={{
                background: 'var(--accent-glow)',
                borderColor: 'rgba(124,106,255,0.25)',
                color: 'var(--accent2)',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.background = 'rgba(124,106,255,0.3)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.background = 'var(--accent-glow)';
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
