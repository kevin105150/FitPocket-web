import { useEffect, useRef } from 'react';

// Global stack to keep track of active modal close handlers
const activeModalsStack: { id: string; close: () => void }[] = [];

// Flag to indicate if a popstate is triggered by programmatic history cleanup
let isProgrammaticBack = false;

// Single global popstate event listener
let isGlobalPopStateRegistered = false;

const globalPopStateHandler = (event: PopStateEvent) => {
  if (isProgrammaticBack) {
    isProgrammaticBack = false;
    return;
  }

  // If we have active modals, close the top-most one
  if (activeModalsStack.length > 0) {
    const topModal = activeModalsStack[activeModalsStack.length - 1];
    topModal.close();
  }
};

export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const stateId = 'modal_' + Math.random().toString(36).substring(2, 11);
    let pushed = false;
    let timeoutId: any = null;

    const closeHandler = () => {
      onCloseRef.current();
    };

    // Schedule the pushState asynchronously to avoid React 18 Strict Mode double-triggering in dev
    timeoutId = setTimeout(() => {
      window.history.pushState({ modalId: stateId }, '');
      pushed = true;
      activeModalsStack.push({ id: stateId, close: closeHandler });
    }, 10); // 10ms is safe and feels instant

    // Register global listener if not already done
    if (!isGlobalPopStateRegistered) {
      window.addEventListener('popstate', globalPopStateHandler);
      isGlobalPopStateRegistered = true;
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Remove from the global stack
      const index = activeModalsStack.findIndex(item => item.id === stateId);
      if (index !== -1) {
        activeModalsStack.splice(index, 1);
      }

      // If we are unmounting and we have pushed a state, and we are STILL at that state in browser history,
      // it means the user closed the modal manually (clicked 'X'). We must pop the history entry.
      if (pushed) {
        if (window.history.state?.modalId === stateId) {
          isProgrammaticBack = true;
          window.history.back();
          // Fallback reset in case popstate is not fired or delayed
          setTimeout(() => {
            isProgrammaticBack = false;
          }, 100);
        }
      }
    };
  }, [isOpen]);
}
