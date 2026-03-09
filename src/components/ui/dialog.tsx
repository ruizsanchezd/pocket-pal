import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const [isHovering, setIsHovering] = React.useState(false);
  const [keyboardShift, setKeyboardShift] = React.useState(0);

  React.useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const initialHeight = vv.height;
    const onResize = () => {
      const keyboardHeight = initialHeight - vv.height;
      if (keyboardHeight < 100) { setKeyboardShift(0); return; }
      // Use the actual focused input position to calculate the exact shift needed.
      // If iOS already centered it (warm keyboard), shift will be 0 or minimal.
      // If iOS left it below center (cold keyboard), we shift exactly enough.
      const active = document.activeElement as HTMLElement | null;
      if (!active || !['INPUT', 'TEXTAREA'].includes(active.tagName)) { setKeyboardShift(0); return; }
      const rect = active.getBoundingClientRect();
      const inputCenter = rect.top + rect.height / 2;
      const desiredCenter = vv.height / 2;
      setKeyboardShift(Math.max(0, inputCenter - desiredCenter));
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  return (
    <DialogPortal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 overflow-y-auto overflow-x-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <div
          className="flex flex-col min-h-full items-center"
          style={keyboardShift > 0 ? { transform: `translateY(-${keyboardShift}px)`, transition: 'transform 200ms ease-out' } : undefined}
        >

          {/* Mobile: spacer que empuja la card al fondo (bottom sheet) */}
          <div className="flex-1 md:hidden" aria-hidden="true" />

          {/* Desktop: zona de cierre con hover */}
          <div
            className="hidden md:flex flex-1 min-h-[32px] w-full max-w-lg sm:max-w-[520px] cursor-pointer items-end justify-center pb-2"
            onMouseMove={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
          >
            <span
              className="text-sm text-white/70 select-none"
              style={{ opacity: isHovering ? 1 : 0, transition: 'opacity 150ms ease' }}
            >
              ↓ ESC para cerrar
            </span>
          </div>

          <DialogPrimitive.Content
            ref={ref}
            className={cn(
              "relative z-50 grid w-full max-w-lg sm:max-w-[520px] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-t-[12px] sm:rounded-lg overflow-x-hidden",
              className,
            )}
            style={{
              transform: isHovering ? "translateY(8px)" : "translateY(0)",
              transition: "transform 200ms ease-out",
            }}
            {...props}
          >
            {/* Drag handle visible solo en mobile */}
            <div className="md:hidden absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
            {children}
          </DialogPrimitive.Content>

          {/* Desktop: spacer inferior para centrar */}
          <div className="hidden md:block flex-1 min-h-[32px]" aria-hidden="true" />

        </div>
      </DialogPrimitive.Overlay>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
