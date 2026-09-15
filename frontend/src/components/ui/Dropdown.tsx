import type { ReactElement, ReactNode } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
export interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}
export interface DropdownProps {
  trigger: ReactElement;
  items: DropdownItem[];
  align?: "left" | "right";
}
export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>{trigger}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          className="ui-menu"
          align={align === "right" ? "end" : "start"}
          sideOffset={8}
          collisionPadding={12}
        >
          {items.map((item) => (
            <Menu.Item
              className={`ui-menu-item ${item.danger ? "text-red-300" : ""}`}
              key={item.label}
              disabled={item.disabled}
              onSelect={item.onClick}
            >
              {item.icon}
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
