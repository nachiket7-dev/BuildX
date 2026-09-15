import type { ReactElement, ReactNode } from "react";
import * as Primitive from "@radix-ui/react-tooltip";
export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  position?: "top" | "bottom" | "left" | "right";
  delay?: number;
}
export function Tooltip({
  content,
  children,
  position = "top",
  delay = 200,
}: TooltipProps) {
  return (
    <Primitive.Provider delayDuration={delay}>
      <Primitive.Root>
        <Primitive.Trigger asChild>{children}</Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            className="ui-tooltip"
            side={position}
            sideOffset={6}
            collisionPadding={8}
          >
            {content}
            <Primitive.Arrow className="fill-zinc-700" />
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
    </Primitive.Provider>
  );
}
