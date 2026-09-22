import { useEffect, useRef } from 'react';

export function useModalBackHandler(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    let pushed = false;
    let timeoutId: any = null;
    const stateId = 'modal_' + Math.random().toString(36).substring(2, 11);

    // Schedule the pushState asynchronously to avoid React 18 Strict Mode double-triggering in dev
    timeoutId = setTimeout(() => {
      window.history.pushState({ modalId: stateId }, '');
      pushed = true;
    }, 10); // 10ms is safe and feels instant

    const handlePopState = (event: PopStateEvent) => {
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      if (pushed) {
        if (window.history.state?.modalId === stateId) {
          window.history.back();
        }
      }
    };
  }, [isOpen]);
}
