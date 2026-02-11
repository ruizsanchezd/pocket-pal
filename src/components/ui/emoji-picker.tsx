import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const EMOJI_CATEGORIES = {
  'Comida': ['🍕', '🍔', '🍞', '🥗', '🍎', '☕', '🍺', '🍷', '🛒', '🍽️'],
  'Transporte': ['🚗', '⛽', '🚌', '✈️', '🚲', '🏍️', '🚕', '🚇', '🅿️', '🛣️'],
  'Hogar': ['🏠', '💡', '🔧', '🧹', '🛋️', '🌡️', '📦', '🔑', '🏗️', '🪴'],
  'Salud': ['💊', '🏥', '🩺', '💪', '🧘', '🦷', '👓', '🩹', '❤️', '🧴'],
  'Ocio': ['🎬', '🎮', '📚', '🎵', '🏖️', '⚽', '🎨', '🎭', '📸', '🎯'],
  'Finanzas': ['💰', '💳', '🏦', '📈', '📉', '💵', '🪙', '💎', '🧾', '📊'],
  'Trabajo': ['💼', '🖥️', '📱', '📧', '🎓', '📝', '🔔', '⏰', '📅', '🗂️'],
  'Otros': ['🎁', '👶', '🐾', '👗', '💇', '🧺', '♻️', '❓', '⭐', '🔥'],
};

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-20 text-lg">
          {value || '😀'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category}>
              <p className="text-xs text-muted-foreground mb-1">{category}</p>
              <div className="grid grid-cols-10 gap-1">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={`w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-lg ${
                      value === emoji ? 'bg-muted ring-1 ring-primary' : ''
                    }`}
                    onClick={() => {
                      onChange(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
