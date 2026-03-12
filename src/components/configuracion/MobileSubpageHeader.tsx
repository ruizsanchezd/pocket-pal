import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileSubpageHeaderProps {
  title: string;
  backHref: string;
}

export function MobileSubpageHeader({ title, backHref }: MobileSubpageHeaderProps) {
  const navigate = useNavigate();
  const titleRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      {/* Fixed compact bar — mobile only, slides in when title leaves viewport */}
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 h-14 flex items-center gap-1 px-2',
          'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b',
          'transition-transform duration-200 md:hidden',
          isScrolled ? 'translate-y-0' : '-translate-y-full'
        )}
      >
        <Button variant="ghost" size="icon" onClick={() => navigate(backHref)} className="h-11 w-11">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <span className="text-base font-semibold truncate">{title}</span>
      </div>

      {/* Inline header — back arrow + title */}
      <div ref={titleRef} className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(backHref)} className="h-11 w-11">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
    </div>
  );
}
