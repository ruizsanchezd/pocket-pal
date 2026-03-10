import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

export interface CreatableSelectProps {
  options: { value: string; label: string; color?: string }[];
  value: string;
  onValueChange: (value: string) => void;
  onCreate: (name: string) => Promise<string | null>;
  placeholder?: string;
  createLabel?: string;
  disabled?: boolean;
  allowNone?: boolean;
  emptyText?: string;
}

export function CreatableSelect({
  options,
  value,
  onValueChange,
  onCreate,
  placeholder = "Seleccionar...",
  createLabel = "Crear nueva...",
  disabled = false,
  allowNone = false,
  emptyText = "No se encontraron resultados",
}: CreatableSelectProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const collapseTimer = React.useRef<ReturnType<typeof setTimeout>>();
  const [isInlineCreating, setIsInlineCreating] = React.useState(false);
  const [createValue, setCreateValue] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const inlineInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  const handleCreate = async () => {
    const trimmedValue = createValue.trim();

    if (trimmedValue.length < 2) {
      setError("Mínimo 2 caracteres");
      return;
    }

    const isDuplicate = options.some(
      (opt) => opt.label.toLowerCase() === trimmedValue.toLowerCase()
    );

    if (isDuplicate) {
      setError("Ya existe con ese nombre");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const newId = await onCreate(trimmedValue);

      if (newId) {
        onValueChange(newId);
        setOpen(false);
        setIsInlineCreating(false);
        setCreateValue("");
      } else {
        setError("Error al crear. Intenta de nuevo.");
      }
    } catch {
      setError("Error al crear. Intenta de nuevo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelInline = () => {
    setIsInlineCreating(false);
    setCreateValue("");
    setError("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setIsInlineCreating(false);
      setCreateValue("");
      setError("");
      setIsExpanded(false);
    }
  };

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 0) {
      clearTimeout(collapseTimer.current);
      setIsExpanded(true);
    } else {
      collapseTimer.current = setTimeout(() => setIsExpanded(false), 80);
    }
  };

  const handleStartInlineCreate = () => {
    setIsInlineCreating(true);
    setCreateValue("");
    setError("");
    if (!isMobile) {
      setTimeout(() => inlineInputRef.current?.focus(), 0);
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
        selectedOption.color ? (
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: `${selectedOption.color}25`,
              color: selectedOption.color,
              filter: "brightness(0.85)",
            }}
          >
            {selectedOption.label}
          </span>
        ) : (
          selectedOption.label
        )
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  // Inline create row — used in both desktop and mobile
  const inlineCreateRow = (
    <div className="border-t">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Plus className="h-4 w-4 text-primary shrink-0" />
        <input
          ref={inlineInputRef}
          value={createValue}
          onChange={(e) => {
            setCreateValue(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            } else if (e.key === "Escape") {
              e.preventDefault();
              handleCancelInline();
            }
          }}
          placeholder="Nombre... (Enter para guardar)"
          className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          disabled={isSaving}
          autoComplete="off"
        />
        {isSaving && (
          <span className="text-xs text-muted-foreground shrink-0">Guardando…</span>
        )}
      </div>
      {error && (
        <p className="px-2 pb-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent
          className={cn(isExpanded && "rounded-t-none")}
          style={{
            height: isExpanded ? '100dvh' : '85dvh',
            maxHeight: isExpanded ? '100dvh' : '85dvh',
            transition: isInlineCreating ? 'none' : 'height 300ms ease-in-out, max-height 300ms ease-in-out, border-top-left-radius 300ms ease-in-out, border-top-right-radius 300ms ease-in-out',
          }}
        >
          <DrawerHeader>
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 pb-8" data-vaul-no-drag onScroll={handleListScroll}>
            {allowNone && (
              <button
                className="w-full text-left py-3 px-2 rounded-lg text-muted-foreground italic flex items-center gap-3 active:bg-accent"
                onClick={() => {
                  onValueChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === "" ? "opacity-100" : "opacity-0")} />
                Ninguna
              </button>
            )}
            {options.map((option) => (
              <button
                key={option.value}
                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 active:bg-accent"
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                }}
              >
                <Check className={cn("h-4 w-4 shrink-0", value === option.value ? "opacity-100" : "opacity-0")} />
                {option.color ? (
                  <span
                    className="px-2 py-0.5 rounded text-sm font-medium"
                    style={{
                      backgroundColor: `${option.color}25`,
                      color: option.color,
                      filter: "brightness(0.85)",
                    }}
                  >
                    {option.label}
                  </span>
                ) : (
                  <span className="text-base">{option.label}</span>
                )}
              </button>
            ))}
            {!isInlineCreating && (
              <button
                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 text-primary active:bg-accent"
                onClick={handleStartInlineCreate}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-base">{createLabel}</span>
              </button>
            )}
          </div>
          {isInlineCreating && (
            <div className="border-t px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Plus className="h-4 w-4 text-primary shrink-0" />
                <input
                  ref={inlineInputRef}
                  value={createValue}
                  onChange={(e) => {
                    setCreateValue(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      handleCancelInline();
                    }
                  }}
                  placeholder="Nombre..."
                  className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
                  disabled={isSaving}
                  autoFocus
                  autoComplete="off"
                />
                {isSaving ? (
                  <span className="text-xs text-muted-foreground shrink-0">Guardando…</span>
                ) : createValue.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="shrink-0 p-1.5 rounded-md bg-primary text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                )}
              </div>
              {error && (
                <p className="px-2 pt-1 text-xs text-destructive">{error}</p>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        side="top"
        avoidCollisions={false}
        style={{
          width: "var(--radix-popover-trigger-width)",
          maxHeight: "calc(var(--radix-popover-content-available-height) - 32px)",
        }}
      >
        <Command>
          <CommandInput placeholder="Buscar..." />
          <CommandList style={{ maxHeight: "calc(var(--radix-popover-content-available-height) - 72px)" }}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value=""
                  className="py-2.5 sm:py-1.5"
                  onSelect={() => {
                    onValueChange("");
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === "" ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground italic">Ninguna</span>
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  className="py-2.5 sm:py-1.5"
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.color ? (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${option.color}25`,
                        color: option.color,
                        filter: "brightness(0.85)",
                      }}
                    >
                      {option.label}
                    </span>
                  ) : (
                    option.label
                  )}
                </CommandItem>
              ))}
              {!isInlineCreating && (
                <CommandItem
                  onSelect={handleStartInlineCreate}
                  className="py-2.5 sm:py-1.5 text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
          {isInlineCreating && inlineCreateRow}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
