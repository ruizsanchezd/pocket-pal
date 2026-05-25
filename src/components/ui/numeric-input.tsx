import * as React from 'react';
import { Input } from '@/components/ui/input';

interface NumericInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value?: number | null;
  onValueChange: (value: number | undefined) => void;
}

/**
 * Input numérico que evita el bug de `type="number"` donde el último dígito
 * no se puede borrar con backspace. Usa `type="text" inputMode="decimal"` y
 * mantiene un estado local de string desacoplado del valor numérico del form.
 *
 * - Acepta coma decimal (`,`) además de punto (`.`).
 * - No sincroniza desde el valor externo mientras el input está enfocado,
 *   lo que permite estados intermedios como `""`, `"-"` o `"20."`.
 * - Al perder el foco, si el valor externo cambió, sincroniza el string.
 */
export const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, onBlur, ...props }, ref) => {
    const toStr = (v: number | null | undefined) =>
      v === undefined || v === null ? '' : String(v);

    const [str, setStr] = React.useState(() => toStr(value));
    const [isFocused, setIsFocused] = React.useState(false);

    // Sync el string mostrado desde el valor externo, solo cuando no está enfocado
    // (evita sobreescribir estados intermedios mientras el usuario escribe)
    React.useEffect(() => {
      if (isFocused) return;
      const parsed = str === '' ? undefined : parseFloat(str.replace(',', '.'));
      if (parsed !== value) {
        setStr(toStr(value));
      }
    }, [value, isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        value={str}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => {
          setIsFocused(false);
          onBlur?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setStr(raw);
          const normalized = raw.replace(',', '.').trim();
          if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') {
            onValueChange(undefined);
            return;
          }
          const n = parseFloat(normalized);
          if (Number.isFinite(n)) onValueChange(n);
        }}
      />
    );
  }
);
NumericInput.displayName = 'NumericInput';
