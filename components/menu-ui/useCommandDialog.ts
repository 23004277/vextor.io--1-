import { useEffect } from 'react';

type UseCommandDialogOptions = {
  containerRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  autoFocusSelector?: string;
  restoreOverflow?: boolean;
};

const getFocusableElements = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);
};

export const useCommandDialog = ({
  containerRef,
  onClose,
  autoFocusSelector = '[data-autofocus="true"]',
  restoreOverflow = true,
}: UseCommandDialogOptions) => {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (restoreOverflow) {
      document.body.style.overflow = 'hidden';
    }

    const focusTarget =
      container.querySelector<HTMLElement>(autoFocusSelector) ?? getFocusableElements(container)[0];
    window.setTimeout(() => focusTarget?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (restoreOverflow) {
        document.body.style.overflow = previousOverflow;
      }
      previousFocus?.focus?.();
    };
  }, [autoFocusSelector, containerRef, onClose, restoreOverflow]);
};

