import React from 'react';
import { TABS } from '../lib/utils';
import type { TabId } from '../lib/types';

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <div
      className="flex gap-1 overflow-x-auto pb-0 mb-8"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {TABS.map(({ id, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id as TabId)}
            className="font-mono-custom text-xs px-4 py-2.5 transition-all duration-150 whitespace-nowrap border-b-2 -mb-px"
            style={{
              color: isActive ? 'var(--accent2)' : 'var(--text3)',
              borderBottomColor: isActive ? 'var(--accent)' : 'transparent',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)';
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
