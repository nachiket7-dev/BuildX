import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface SidebarItem {
  id: string;
  idea: string;
  appName: string;
  complexity: string;
  createdAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user, token, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  // Get current blueprint id from URL
  const currentId = location.pathname.match(/\/blueprint\/(.+)/)?.[1] || null;

  // Load user's blueprints ONLY after auth is ready (after /me claims unclaimed blueprints)
  useEffect(() => {
    if (!user || !token || !authReady) {
      setItems([]);
      return;
    }
    loadBlueprints();
  }, [user, token, authReady]);

  async function loadBlueprints() {
    if (!token) return;
    setLoading(true);
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/api/auth/my-blueprints`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems((data as { data: SidebarItem[] }).data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  // Refresh when navigating to a new blueprint
  useEffect(() => {
    if (currentId && user) {
      loadBlueprints();
    }
  }, [currentId]);

  async function handleRename(id: string) {
    if (!editTitle.trim() || !token) return;
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/api/auth/blueprint/${id}/rename`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editTitle.trim() }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, idea: editTitle.trim() } : item
          )
        );
      }
    } catch {
      // silent
    }
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!token) return;
    try {
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/api/auth/blueprint/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.id !== id));
        if (currentId === id) navigate('/');
      }
    } catch {
      // silent
    }
    setMenuId(null);
  }

  function startEditing(item: SidebarItem) {
    setEditingId(item.id);
    setEditTitle(item.appName || item.idea);
    setMenuId(null);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function groupByDate(items: SidebarItem[]): { label: string; items: SidebarItem[] }[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const lastWeek = new Date(today.getTime() - 7 * 86400000);

    const groups: { label: string; items: SidebarItem[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Last 7 Days', items: [] },
      { label: 'Older', items: [] },
    ];

    items.forEach((item) => {
      const date = new Date(item.createdAt + 'Z');
      if (date >= today) groups[0].items.push(item);
      else if (date >= yesterday) groups[1].items.push(item);
      else if (date >= lastWeek) groups[2].items.push(item);
      else groups[3].items.push(item);
    });

    return groups.filter((g) => g.items.length > 0);
  }

  if (!user) return null;

  const groups = groupByDate(items);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className="fixed top-0 left-0 z-40 h-full flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          width: '280px',
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <button
            onClick={() => {
              navigate('/');
              if (window.innerWidth < 768) onToggle();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl w-full transition-all duration-150"
            style={{
              background: 'var(--accent-glow)',
              border: '1px solid rgba(124,106,255,0.2)',
              color: 'var(--accent2)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="font-mono-custom text-xs font-medium">New Blueprint</span>
          </button>

          <button
            onClick={onToggle}
            className="ml-2 p-2 rounded-lg transition-colors flex-shrink-0"
            style={{ color: 'var(--text3)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {loading && items.length === 0 && (
            <div className="flex justify-center py-8">
              <div
                className="w-5 h-5 border-2 rounded-full animate-spin-slow"
                style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
              />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="text-center py-8 px-4">
              <p className="text-2xl mb-2">💡</p>
              <p className="font-mono-custom text-[11px]" style={{ color: 'var(--text3)' }}>
                Your blueprints will appear here
              </p>
            </div>
          )}

          {groups.map(({ label, items: groupItems }) => (
            <div key={label} className="mb-4">
              <div
                className="font-mono-custom text-[10px] uppercase tracking-wider px-3 py-1.5"
                style={{ color: 'var(--text3)' }}
              >
                {label}
              </div>

              {groupItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative"
                >
                  {editingId === item.id ? (
                    /* Rename input */
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRename(item.id);
                      }}
                      className="px-2 py-1"
                    >
                      <input
                        ref={editRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={() => handleRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-xs border"
                        style={{
                          background: 'var(--surface2)',
                          borderColor: 'rgba(124,106,255,0.4)',
                          color: 'var(--text)',
                          outline: 'none',
                        }}
                      />
                    </form>
                  ) : (
                    /* Chat item */
                    <button
                      onClick={() => {
                        navigate(`/blueprint/${item.id}`);
                        if (window.innerWidth < 768) onToggle();
                        setMenuId(null);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all duration-100 flex items-center gap-2"
                      style={{
                        background: currentId === item.id ? 'var(--surface2)' : 'transparent',
                        color: currentId === item.id ? 'var(--text)' : 'var(--text2)',
                      }}
                      onMouseEnter={(e) => {
                        if (currentId !== item.id)
                          (e.currentTarget as HTMLElement).style.background = 'var(--surface2)';
                      }}
                      onMouseLeave={(e) => {
                        if (currentId !== item.id)
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <span className="truncate flex-1">
                        {item.appName || item.idea.slice(0, 40)}
                      </span>

                      {/* Action dots */}
                      <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(menuId === item.id ? null : item.id);
                        }}
                        style={{ color: 'var(--text3)' }}
                      >
                        ⋯
                      </span>
                    </button>
                  )}

                  {/* Context menu */}
                  {menuId === item.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuId(null)}
                      />
                      <div
                        className="absolute right-2 top-full z-20 w-36 rounded-lg border p-1 shadow-lg"
                        style={{
                          background: 'var(--surface2)',
                          borderColor: 'var(--border2)',
                        }}
                      >
                        <button
                          onClick={() => startEditing(item)}
                          className="w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2"
                          style={{ color: 'var(--text2)' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--surface3)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                          Rename
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2"
                          style={{ color: 'var(--coral)' }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'var(--coral-dim)';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-3 flex items-center gap-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
              {user.name}
            </p>
            <p className="font-mono-custom text-[10px] truncate" style={{ color: 'var(--text3)' }}>
              {items.length} blueprint{items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
