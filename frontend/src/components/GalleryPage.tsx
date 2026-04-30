import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { complexityColor } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

interface BlueprintListItem {
  id: string;
  idea: string;
  appName: string;
  description: string;
  complexity: string;
  createdAt: string;
  views: number;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + 'Z');
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function GalleryPage() {
  const { user, token } = useAuth();
  const [items, setItems] = useState<BlueprintListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const BASE_URL = import.meta.env.VITE_API_URL ?? '';

        // If logged in, fetch only user's blueprints
        // Otherwise, fetch all public blueprints
        const url = user && token
          ? `${BASE_URL}/api/auth/my-blueprints`
          : `${BASE_URL}/api/blueprint/list`;

        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        setItems((data as { data: BlueprintListItem[] }).data);
      } catch (err) {
        setError('Failed to load blueprints');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, token]);

  const isPersonal = !!user;

  return (
    <section className="px-4 sm:px-6 py-8 sm:py-12 max-w-5xl mx-auto overflow-hidden">
      {/* Page header */}
      <div className="mb-8 sm:mb-10">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3 sm:gap-4 mb-2">
          <div>
            <div
              className="font-mono-custom text-xs uppercase tracking-widest mb-2"
              style={{ color: 'var(--accent2)' }}
            >
              {isPersonal ? '// my blueprints' : '// blueprint gallery'}
            </div>
            <h1
              className="font-display font-extrabold text-2xl sm:text-3xl"
              style={{ color: 'var(--text)', letterSpacing: '-1px' }}
            >
              {isPersonal ? 'My Blueprints' : 'Recent Blueprints'}
            </h1>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-[10px] border text-xs sm:text-sm font-medium transition-all duration-150 flex-shrink-0"
            style={{
              background: 'var(--accent)',
              borderColor: 'rgba(124,106,255,0.4)',
              color: 'white',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            New Blueprint
          </Link>
        </div>
        <p className="text-sm" style={{ color: 'var(--text3)' }}>
          {isPersonal
            ? 'Your generated blueprints. Click any card to view or refine.'
            : 'Browse all generated blueprints. Click any card to view the full blueprint.'}
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-20 gap-4">
          <div
            className="w-8 h-8 border-2 rounded-full animate-spin-slow"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
          />
          <p className="font-mono-custom text-xs" style={{ color: 'var(--text3)' }}>
            Loading blueprints...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="card p-6 text-center"
          style={{ borderColor: 'rgba(248,113,113,0.3)' }}
        >
          <p className="text-sm" style={{ color: 'var(--coral)' }}>
            {error}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">🏗️</p>
          <h3
            className="font-display font-bold text-lg mb-2"
            style={{ color: 'var(--text)' }}
          >
            No blueprints yet
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text3)' }}>
            Generate your first blueprint to see it here.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-[10px] text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Generate Blueprint
          </Link>
        </div>
      )}

      {/* Blueprint grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item, i) => (
            <Link
              key={item.id}
              to={`/blueprint/${item.id}`}
              className="card p-5 transition-all duration-200 hover:scale-[1.02] group block"
              style={{
                animationDelay: `${i * 50}ms`,
              }}
            >
              {/* App name + complexity */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3
                  className="font-display font-bold text-sm truncate flex-1 group-hover:text-accent transition-colors"
                  style={{ color: 'var(--text)' }}
                >
                  {item.appName}
                </h3>
                <span
                  className={`font-mono-custom text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${complexityColor(item.complexity as 'Low' | 'Medium' | 'High')}`}
                >
                  {item.complexity}
                </span>
              </div>

              {/* Description */}
              <p
                className="text-xs leading-relaxed mb-4 line-clamp-2"
                style={{ color: 'var(--text3)' }}
              >
                {item.description || item.idea}
              </p>

              {/* Meta */}
              <div className="flex items-center justify-between">
                <span
                  className="font-mono-custom text-[10px]"
                  style={{ color: 'var(--text3)' }}
                >
                  {timeAgo(item.createdAt)}
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className="font-mono-custom text-[10px] flex items-center gap-1"
                    style={{ color: 'var(--text3)' }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {item.views}
                  </span>
                  <span
                    className="font-mono-custom text-[10px]"
                    style={{ color: 'var(--accent2)' }}
                  >
                    View →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
