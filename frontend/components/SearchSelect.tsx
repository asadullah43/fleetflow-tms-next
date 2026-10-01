'use client';

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Icon } from './icons';

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}

/**
 * A text field that, on click/focus, drops down the known values for that
 * column (e.g. every location already added) and narrows the list as you
 * type — click a row to fill it in exactly. Falls back to whatever free
 * text was typed if nothing in the list is picked, so it still works as a
 * substring filter.
 */
export function SearchSelect({ value, onChange, options, placeholder, onKeyDown, className }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => o.toLowerCase().includes(q)) : options).slice(0, 50);

  return (
    <div className={className ? `search-select ${className}` : 'search-select'} ref={wrapRef}>
      <div className="search-field">
        <Icon.search size={15} />
        <input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            onKeyDown?.(e);
          }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="search-select-menu">
          {filtered.map((opt) => (
            <button
              type="button"
              key={opt}
              className="search-select-option"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
