import { useId } from "react";
import { motion } from "framer-motion";
import { TABS } from "../lib/utils";
import type { TabId } from "../lib/types";
export function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  const instance = useId();
  return (
    <div
      className="blueprint-tabbar"
      role="tablist"
      aria-label="Blueprint sections"
    >
      {TABS.map(({ id, label }, index) => (
        <button
          key={id}
          id={`blueprint-tab-${id}`}
          type="button"
          role="tab"
          aria-controls="blueprint-content"
          aria-selected={activeTab === id}
          tabIndex={activeTab === id ? 0 : -1}
          onClick={() => onChange(id)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? TABS.length - 1
                  : (index +
                      (event.key === "ArrowRight" ? 1 : -1) +
                      TABS.length) %
                    TABS.length;
            onChange(TABS[next].id);
            (
              event.currentTarget.parentElement?.children[
                next
              ] as HTMLButtonElement
            )?.focus();
          }}
        >
          {activeTab === id && (
            <motion.i
              className="blueprint-tab-pill"
              layoutId={`blueprint-tab-${instance}`}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
            />
          )}
          <span>
            <small>{String(index + 1).padStart(2, "0")}</small>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
