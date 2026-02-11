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

export interface CreatableSelectProps {
  options: { value: string; label: string }[];
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
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<"select" | "create">("select");
  const [createValue, setCreateValue] = React.useState("");
  const [isCreating, setIsCreating] = React.useState(false);
  const [error, setError] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  const handleCreate = async () => {
    // Validation
    const trimmedValue = createValue.trim();

    if (trimmedValue.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    // Check for duplicates (case-insensitive)
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
    } catch (err) {
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
      // Reset to select mode when closing
      setMode("select");
      setCreateValue("");
      setError("");
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        {mode === "select" ? (
          <Command>
            <CommandInput placeholder={`Buscar...`} />
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
                    {option.label}
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
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
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
        )}
      </PopoverContent>
    </Popover>
  );
}
