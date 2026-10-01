'use client';

import { KeyboardEvent, useRef } from 'react';
import { Icon } from './icons';

interface DateFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** 'boxed' draws its own bordered box (modal forms); 'inline' sits inside a parent .search-field box (filter bars). */
  variant?: 'boxed' | 'inline';
}

/**
 * Date input that only opens the picker from the calendar icon — clicking
 * the field itself just focuses it for typing, it doesn't pop the
 * calendar. The native per-browser calendar indicator is hidden via CSS
 * (see .date-field in globals.css); the icon button opens the picker
 * with the standard `showPicker()` API.
 */
export function DateField({ value, onChange, id, required, disabled, ariaLabel, onKeyDown, variant = 'boxed' }: DateFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (disabled) return;
    const input = ref.current;
    const showPicker = (input as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker;
    if (input && typeof showPicker === 'function') {
      try {
        showPicker.call(input);
        return;
      } catch {
        // Falls through to focus below (e.g. browser blocks showPicker outside a user gesture).
      }
    }
    input?.focus();
  }

  return (
    <div className={variant === 'boxed' ? 'date-field date-field-boxed' : 'date-field'}>
      <button type="button" className="date-field-trigger" onClick={openPicker} disabled={disabled} tabIndex={-1} aria-label={`Open calendar${ariaLabel ? ` for ${ariaLabel}` : ''}`}>
        <Icon.calendar size={15} />
      </button>
      <input
        ref={ref}
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
