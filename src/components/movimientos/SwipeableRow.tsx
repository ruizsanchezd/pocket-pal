import { useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onThresholdReached?: () => void;
}

export function SwipeableRow({ children, onDelete, onThresholdReached }: SwipeableRowProps) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const isDragging = useRef(false);
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const thresholdFired = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = -80;

  const applyOffset = (offset: number, animated: boolean) => {
    if (!innerRef.current || !bgRef.current) return;
    innerRef.current.style.transition = animated ? 'transform 200ms ease-out' : 'none';
    innerRef.current.style.transform = `translateX(${offset}px)`;
    bgRef.current.style.opacity = String(Math.min(1, Math.abs(offset) / Math.abs(THRESHOLD)));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentOffset.current = 0;
    isDragging.current = true;
    directionLocked.current = null;
    thresholdFired.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;

    const deltaX = e.touches[0].clientX - startX.current;
    const deltaY = e.touches[0].clientY - startY.current;

    if (directionLocked.current === null) {
      if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
        directionLocked.current = Math.abs(deltaY) > Math.abs(deltaX) ? 'vertical' : 'horizontal';
      } else {
        return;
      }
    }

    if (directionLocked.current === 'vertical') {
      isDragging.current = false;
      return;
    }

    e.preventDefault();

    const offset = Math.min(0, deltaX);
    currentOffset.current = offset;
    applyOffset(offset, false);

    if (offset <= THRESHOLD && !thresholdFired.current) {
      thresholdFired.current = true;
      onThresholdReached?.();
    }
    if (offset > THRESHOLD && thresholdFired.current) {
      thresholdFired.current = false;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (currentOffset.current <= THRESHOLD) {
      // Animate out fully then delete
      if (innerRef.current) {
        innerRef.current.style.transition = 'transform 200ms ease-out';
        innerRef.current.style.transform = `translateX(-100%)`;
      }
      setTimeout(() => {
        onDelete();
      }, 200);
    } else {
      // Spring back
      applyOffset(0, true);
      thresholdFired.current = false;
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Red background */}
      <div
        ref={bgRef}
        className="absolute inset-y-0 right-0 w-full bg-destructive flex items-center justify-end px-6 opacity-0"
        aria-hidden="true"
      >
        <Trash2 className="h-5 w-5 text-white" />
      </div>
      {/* Swipeable content */}
      <div
        ref={innerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="bg-background"
        style={{ transform: 'translateX(0px)', touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  );
}
