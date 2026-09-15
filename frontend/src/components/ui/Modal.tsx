import { useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from './icons';
import { cn } from "../../lib/utils";
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showClose?: boolean;
}
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showClose = true,
}: ModalProps) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="ui-modal-overlay" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            previousFocus.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (previousFocus.current?.isConnected)
              previousFocus.current.focus();
          }}
          className={cn("ui-modal", `ui-modal--${size}`)}
          {...(!description ? { "aria-describedby": undefined } : {})}
        >
          <div className="ui-modal-heading">
            <div>
              <Dialog.Title
                className={title ? "text-lg font-semibold" : "sr-only"}
              >
                {title || "Dialog"}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-2 text-sm text-zinc-400">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {showClose && (
              <Dialog.Close
                className="ui-icon-button"
                aria-label="Close dialog"
              >
                <X size={18} />
              </Dialog.Close>
            )}
          </div>
          <div className="ui-modal-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
