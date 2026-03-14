import { Alert, AlertDescription } from '@/components/ui/alert';
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
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>¿Generar gastos recurrentes para este mes?</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
          >
            No
          </Button>
          <Button
            size="sm"
            onClick={onGenerate}
          >
            Sí, generar
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
