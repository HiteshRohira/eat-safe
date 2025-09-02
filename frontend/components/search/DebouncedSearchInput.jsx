import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const debounceMs = 400;
/**
 * DebouncedSearchInput
 *
 * A shared search input with built-in debouncing and clear action.
 *
 * Props:
 * - value?: string
 * - onChange?: (debouncedValue: string) => void             // fired after debounce
 * - placeholder?: string
 * - ariaLabel?: string
 * - className?: string                                      // wrapper class
 * - onImmediateChange?: (value: string) => void             // fired immediately on keystroke
 * - debounceMs?: number                                     // default 400ms
 * - inputClassName?: string                                 // input element class
 * - clearable?: boolean                                     // show Clear button, default true
 * - autoFocus?: boolean
 * - disabled?: boolean
 * - onSubmit?: (value: string) => void                      // fired immediately on Enter
 */
function DebouncedSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel = "Search",
  className = "",
}) {
  const [localValue, setLocalValue] = useState(value ?? "");
  const firstRenderRef = useRef(true);

  // Keep local value in sync if parent updates value prop
  useEffect(() => {
    // Avoid overwriting user typing on first mount if value is undefined
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      if (typeof value === "string") {
        setLocalValue(value);
      }
      return;
    }
    if (typeof value === "string" && value !== localValue) {
      setLocalValue(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Debounce and emit to parent
  useEffect(() => {
    const handle = setTimeout(
      () => {
        onChange?.(localValue);
      },
      Math.max(0, debounceMs),
    );

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, debounceMs]);

  const handleInput = (e) => {
    const v = e?.target?.value ?? "";
    setLocalValue(v);
  };

  const handleClear = () => {
    setLocalValue("");
    // Clear should flush immediately
    onChange?.("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      // Also flush debounced change immediately on Enter
      onChange?.(localValue);
    }
  };

  return (
    <div className={`flex items-stretch gap-3 ${className}`}>
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        className={`flex-1`}
      />
      {!!localValue && (
        <Button
          variant="ghost"
          onClick={handleClear}
          className="self-end sm:self-auto"
          type="button"
        >
          Clear
        </Button>
      )}
    </div>
  );
}

export default DebouncedSearchInput;
