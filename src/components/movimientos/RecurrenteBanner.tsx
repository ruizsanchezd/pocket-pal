import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface RecurrenteBannerProps {
  show: boolean;
  onDismiss: () => void;
  onGenerate: () => void;
}

export function RecurrenteBanner({ show, onDismiss, onGenerate }: RecurrenteBannerProps) {
  if (!show) return null;

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="text-sm">¿Generar gastos recurrentes para este mes?</span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onDismiss}>No</Button>
        <Button size="sm" onClick={onGenerate}>Sí, generar</Button>
      </div>
    </div>
  );
}
