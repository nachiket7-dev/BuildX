import * as Tabs from '@radix-ui/react-tabs';
import { TABS } from '../lib/utils';
import type { TabId } from '../lib/types';

interface TabBarProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ activeTab, onChange }: TabBarProps) {
  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(value) => onChange(value as TabId)}
      className="bp-tab-bar"
    >
      <div className="bp-tab-bar__scroll-wrap">
        <Tabs.List className="bp-tab-bar__list" aria-label="Blueprint sections">
          {TABS.map(({ id, label }) => (
            <Tabs.Trigger key={id} value={id} className="bp-tab-bar__trigger">
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <div className="bp-tab-bar__fade bp-tab-bar__fade--left" aria-hidden />
        <div className="bp-tab-bar__fade bp-tab-bar__fade--right" aria-hidden />
      </div>
    </Tabs.Root>
  );
}
