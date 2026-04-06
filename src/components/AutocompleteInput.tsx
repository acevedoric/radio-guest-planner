import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface Suggestion {
  label: string;
  sublabel?: string;
}

interface AutocompleteInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (index: number) => void;
  suggestions: Suggestion[];
  showSuggestions: boolean;
  onDismiss: () => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const AutocompleteInput = ({
  id,
  value,
  onChange,
  onSelect,
  suggestions,
  showSuggestions,
  onDismiss,
  placeholder,
  disabled,
  required,
}: AutocompleteInputProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(i);
              }}
            >
              <span className="font-medium text-foreground">{s.label}</span>
              {s.sublabel && (
                <span className="text-muted-foreground ml-2 text-xs">{s.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
