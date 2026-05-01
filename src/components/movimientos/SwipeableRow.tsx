import { useRef } from 'react';
import { Trash2, CopyPlus } from 'lucide-react';

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  onDuplicate: () => void;
  onThresholdReached?: () => void;
}

export function SwipeableRow({ children, onDelete, onDuplicate, onThresholdReached }: SwipeableRowProps) {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentOffset = useRef(0);
  const isDragging = useRef(false);
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const thresholdFired = useRef(false);
  const innerRef = useRef<HTMLDivElement>(null);
  const bgDeleteRef = useRef<HTMLDivElement>(null);
  const bgDuplicateRef = useRef<HTMLDivElement>(null);

  const DELETE_THRESHOLD = -80;
  const DUPLICATE_THRESHOLD = 80;

  const applyOffset = (offset: number, animated: boolean) => {
    if (!innerRef.current || !bgDeleteRef.current || !bgDuplicateRef.current) return;
    innerRef.current.style.transition = animated ? 'transform 200ms ease-out' : 'none';
    innerRef.current.style.transform = `translateX(${offset}px)`;

    if (offset < 0) {
      bgDeleteRef.current.style.opacity = String(Math.min(1, Math.abs(offset) / Math.abs(DELETE_THRESHOLD)));
      bgDuplicateRef.current.style.opacity = '0';
    } else if (offset > 0) {
      bgDuplicateRef.current.style.opacity = String(Math.min(1, offset / DUPLICATE_THRESHOLD));
      bgDeleteRef.current.style.opacity = '0';
    } else {
      bgDeleteRef.current.style.opacity = '0';
      bgDuplicateRef.current.style.opacity = '0';
    }
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

    const offset = Math.max(-150, Math.min(150, deltaX));
    currentOffset.current = offset;
    applyOffset(offset, false);

    const absOffset = Math.abs(offset);
    if (absOffset >= Math.min(Math.abs(DELETE_THRESHOLD), DUPLICATE_THRESHOLD) && !thresholdFired.current) {
      thresholdFired.current = true;
      onThresholdReached?.();
    }
    if (absOffset < Math.min(Math.abs(DELETE_THRESHOLD), DUPLICATE_THRESHOLD) && thresholdFired.current) {
      thresholdFired.current = false;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (currentOffset.current <= DELETE_THRESHOLD) {
      if (innerRef.current) {
        innerRef.current.style.transition = 'transform 200ms ease-out';
        innerRef.current.style.transform = `translateX(-100%)`;
      }
      setTimeout(() => {
        onDelete();
      }, 200);
    } else if (currentOffset.current >= DUPLICATE_THRESHOLD) {
      applyOffset(0, true);
      thresholdFired.current = false;
      setTimeout(() => {
        onDuplicate();
      }, 200);
    } else {
      applyOffset(0, true);
      thresholdFired.current = false;
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Green background — swipe right to duplicate */}
      <div
        ref={bgDuplicateRef}
        className="absolute inset-y-0 left-0 w-full bg-green-500 flex items-center justify-start px-6 opacity-0"
        aria-hidden="true"
      >
        <CopyPlus className="h-5 w-5 text-white" />
      </div>
      {/* Red background — swipe left to delete */}
      <div
        ref={bgDeleteRef}
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
