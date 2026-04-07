import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSwipeDownToDismiss } from "@/hooks/use-drawer-swipe-dismiss";

export interface DrawerSelectProps {
  options: { value: string; label: string; color?: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function DrawerSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
  disabled = false,
}: DrawerSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const swipeDismissRef = useSwipeDownToDismiss(() => setOpen(false));
  const [needsFullHeight, setNeedsFullHeight] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);

  const setScrollableRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      swipeDismissRef(node);
    },
    [swipeDismissRef]
  );

  React.useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      if (listRef.current) {
        setNeedsFullHeight(listRef.current.scrollHeight > listRef.current.clientHeight);
      }
    });
  }, [open]);

  const selectedOption = options.find((o) => o.value === value);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setNeedsFullHeight(false);
    }
  };

  const triggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full justify-between"
      disabled={disabled}
    >
      {selectedOption ? (
        <span className="flex items-center gap-2">
          {selectedOption.color && (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          {selectedOption.label}
        </span>
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent
          className={cn(needsFullHeight && "rounded-t-none")}
          style={{
            height: needsFullHeight ? "100dvh" : "85dvh",
            maxHeight: needsFullHeight ? "100dvh" : "85dvh",
          }}
        >
          <DrawerHeader>
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div
            ref={setScrollableRef}
            className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pb-8"
            data-vaul-no-drag
          >
            {options.map((option) => (
              <button
                key={option.value}
                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.color && (
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                )}
                <span className="text-base">{option.label}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center gap-2">
              {option.color && (
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: option.color }} />
              )}
              {option.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
