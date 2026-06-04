import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useBlueprintList, invalidateBlueprintQueries } from '../hooks/useBlueprints';
import {
  Lightbulb,
  MoreHorizontal,
  Plus,
  PanelLeftClose,
  FileCode2,
  Pencil,
  Trash2,
} from 'lucide-react';

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

function SidebarSkeleton() {
  return (
    <div className="sidebar-skeleton px-3 py-2 space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="sidebar-skeleton__row" style={{ animationDelay: `${i * 80}ms` }} />
      ))}
    </div>
  );
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const { user, token, authReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading: loading, refetch } = useBlueprintList(
    'mine',
    Boolean(user && token && authReady)
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  const currentId = location.pathname.match(/\/blueprint\/(.+)/)?.[1] || null;

  useEffect(() => {
    if (user && authReady) {
      refetch();
    }
  }, [location.pathname, user, authReady, refetch]);

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
        await invalidateBlueprintQueries(queryClient);
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
        await invalidateBlueprintQueries(queryClient);
        if (currentId === id) navigate('/create');
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
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`sidebar-panel ${isOpen ? 'sidebar-panel--open' : ''}`}
        aria-label="Blueprint history"
      >
        {/* Aurora accent edge */}
        <div className="sidebar-panel__accent" aria-hidden />

        {/* Header */}
        <div className="sidebar-panel__header">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono-custom text-[10px] uppercase tracking-widest" style={{ color: 'var(--text3)' }}>
              Your work
            </span>
            <button
              onClick={onToggle}
              className="sidebar-icon-btn"
              aria-label="Close sidebar"
            >
              <PanelLeftClose size={16} />
            </button>
          </div>

          <button
            onClick={() => {
              navigate('/create');
              if (window.innerWidth < 768) onToggle();
            }}
            className="sidebar-new-btn btn-shiny w-full"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span className="font-mono-custom text-xs font-medium">New Blueprint</span>
          </button>
        </div>

        {/* Blueprint list */}
        <div className="sidebar-panel__list flex-1 overflow-y-auto">
          {loading && items.length === 0 && <SidebarSkeleton />}

          {!loading && items.length === 0 && (
            <div className="sidebar-empty">
              <div className="sidebar-empty__icon">
                <Lightbulb size={20} />
              </div>
              <p className="font-mono-custom text-[11px] leading-relaxed" style={{ color: 'var(--text3)' }}>
                Your blueprints will appear here
              </p>
            </div>
          )}

          {groups.map(({ label, items: groupItems }) => {
            let flatStartIdx = 0;
            for (const g of groups) {
              if (g.label === label) break;
              flatStartIdx += g.items.length;
            }

            return (
              <div key={label} className="mb-3">
                <div className="sidebar-group-label">{label}</div>

                {groupItems.map((item, groupIdx) => {
                  const flatIdx = flatStartIdx + groupIdx;
                  const isNearBottom = flatIdx >= items.length - 3;
                  const isActive = currentId === item.id;
                  const title = item.appName || item.idea.slice(0, 40);

                  return (
                    <div key={item.id} className="group relative px-2">
                      {editingId === item.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            handleRename(item.id);
                          }}
                          className="py-0.5"
                        >
                          <input
                            ref={editRef}
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onBlur={() => handleRename(item.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="sidebar-rename-input"
                          />
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            navigate(`/blueprint/${item.id}`);
                            if (window.innerWidth < 768) onToggle();
                            setMenuId(null);
                          }}
                          className={`sidebar-item ${isActive ? 'sidebar-item--active' : ''}`}
                        >
                          {isActive && <span className="sidebar-item__bar" aria-hidden />}
                          <FileCode2 size={14} className="sidebar-item__icon flex-shrink-0" />
                          <span className="truncate flex-1 text-left">{title}</span>
                          <span
                            className="sidebar-item__menu opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuId(menuId === item.id ? null : item.id);
                            }}
                          >
                            <MoreHorizontal size={14} />
                          </span>
                        </button>
                      )}

                      {menuId === item.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                          <div
                            className={`sidebar-context-menu ${isNearBottom ? 'sidebar-context-menu--up' : ''}`}
                          >
                            <button onClick={() => startEditing(item)} className="sidebar-context-menu__item">
                              <Pencil size={13} />
                              Rename
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="sidebar-context-menu__item sidebar-context-menu__item--danger"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User footer */}
        <div className="sidebar-panel__footer">
          <div className="sidebar-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
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
