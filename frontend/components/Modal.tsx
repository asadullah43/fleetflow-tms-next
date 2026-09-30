'use client';

import { ReactNode } from 'react';

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}
