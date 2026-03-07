import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [mode, setMode] = React.useState<"select" | "create">("select");
  const [createValue, setCreateValue] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  const handleCreate = async () => {
    const trimmedValue = createValue.trim();

    if (trimmedValue.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    const isDuplicate = options.some(
      (opt) => opt.label.toLowerCase() === trimmedValue.toLowerCase()
    );

    if (isDuplicate) {
      setError("Ya existe una opción con este nombre");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const newId = await onCreate(trimmedValue);

      if (newId) {
        onValueChange(newId);
        setOpen(false);
        setMode("select");
        setCreateValue("");
      } else {
        setError("Error al crear. Intenta de nuevo.");
      }
    } catch {
      setError("Error al crear. Intenta de nuevo.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setMode("select");
    setCreateValue("");
    setError("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setMode("select");
      setCreateValue("");
      setError("");
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

  const createForm = (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Nombre</label>
        <Input
          value={createValue}
          onChange={(e) => {
            setCreateValue(e.target.value);
            setError("");
          }}
          placeholder="Introduce el nombre..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            } else if (e.key === "Escape") {
              handleCancel();
            }
          }}
          disabled={isCreating}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isCreating}
        >
          <X className="mr-1 h-3 w-3" />
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={isCreating || !createValue.trim()}
        >
          <Plus className="mr-1 h-3 w-3" />
          {isCreating ? "Creando..." : "Crear"}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          {mode === "select" ? (
            <div className="overflow-y-auto px-4 pb-8">
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
              <button
                className="w-full text-left py-3 px-2 rounded-lg flex items-center gap-3 text-primary active:bg-accent"
                onClick={() => setMode("create")}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="text-base">{createLabel}</span>
              </button>
            </div>
          ) : (
            createForm
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
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        {mode === "select" ? (
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                {allowNone && (
                  <CommandItem
                    value=""
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
                <CommandItem
                  onSelect={() => setMode("create")}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createLabel}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          createForm
        )}
      </PopoverContent>
    </Popover>
  );
}
