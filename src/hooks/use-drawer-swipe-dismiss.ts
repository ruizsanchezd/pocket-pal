import { useState, useRef, useEffect } from 'react';

/**
 * Attaches native touchstart/touchmove listeners directly to the element (via callback ref)
 * to close a drawer when the user swipes down from the top of the scroll area.
 *
 * Returns a callback ref to attach to the scrollable container.
 * Uses a callback ref (instead of useRef) so that listeners are attached when the element
 * actually mounts into the DOM — Vaul portals use lazy mounting, so the element doesn't
 * exist on initial render when the drawer is closed.
 *
 * Fires onClose only when:
 *  - scroll was at the top when the gesture started (scrollTopAtStart === 0)
 *  - finger moved down more than `threshold` px
 */
export function useSwipeDownToDismiss(onClose: () => void, threshold = 60) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const touchStartY = useRef(0);
  const scrollTopAtStart = useRef(0);
  const fired = useRef(false);
  // Keep onClose stable so the effect doesn't re-run on every render
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!element) return;

    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      scrollTopAtStart.current = element.scrollTop;
      fired.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (fired.current || scrollTopAtStart.current > 0) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > threshold) {
        fired.current = true;
        onCloseRef.current();
      }
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
    };
  }, [element, threshold]);

  return setElement as React.RefCallback<HTMLDivElement>;
}
