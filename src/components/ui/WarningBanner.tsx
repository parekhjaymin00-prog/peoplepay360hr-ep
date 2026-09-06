'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export interface WarningBannerProps {
  type?: 'warning' | 'danger' | 'info' | 'success';
  title?: string;
  items?: string[];
  message?: string;
  actionText?: string;
  onAction?: () => void;
}

export const WarningBanner: React.FC<WarningBannerProps> = ({
  type = 'warning',
  title,
  items,
  message,
  actionText,
  onAction,
}) => {
  const stylesMap = {
    warning: {
      bg: 'var(--color-warning-light)',
      border: 'var(--color-warning-border)',
      text: 'var(--color-warning-text)',
      icon: <AlertTriangle size={20} color="var(--color-warning)" />,
    },
    danger: {
      bg: 'var(--color-danger-light)',
      border: 'var(--color-danger-border)',
      text: 'var(--color-danger-text)',
      icon: <AlertCircle size={20} color="var(--color-danger)" />,
    },
    info: {
      bg: 'var(--color-info-light)',
      border: 'var(--color-info-border)',
      text: 'var(--color-info-text)',
      icon: <Info size={20} color="var(--color-info)" />,
    },
    success: {
      bg: 'var(--color-success-light)',
      border: 'var(--color-success-border)',
      text: 'var(--color-success-text)',
      icon: <CheckCircle2 size={20} color="var(--color-success)" />,
    },
  };

  const current = stylesMap[type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.875rem',
        padding: '0.875rem 1.25rem',
        backgroundColor: current.bg,
        border: `1px solid ${current.border}`,
        borderRadius: 'var(--radius-lg)',
        color: current.text,
        marginBottom: '1rem',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: '2px' }}>{current.icon}</div>
      <div style={{ flex: 1 }}>
        {title && (
          <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            {title}
          </h4>
        )}
        {message && <p style={{ fontSize: '0.8125rem', lineHeight: 1.4 }}>{message}</p>}
        {items && items.length > 0 && (
          <ul style={{ fontSize: '0.8125rem', paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
            {items.map((item, idx) => (
              <li key={idx} style={{ marginBottom: '0.2rem' }}>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
      {actionText && onAction && (
        <button
          onClick={onAction}
          style={{
            alignSelf: 'center',
            backgroundColor: '#ffffff',
            border: `1px solid ${current.border}`,
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: current.text,
            cursor: 'pointer',
          }}
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
