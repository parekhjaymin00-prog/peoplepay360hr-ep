'use client';

import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  id,
  style,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        style={{
          height: '38px',
          padding: '0 0.75rem',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border-color)'}`,
          backgroundColor: '#ffffff',
          color: 'var(--text-primary)',
          fontSize: '0.875rem',
          outline: 'none',
          transition: 'border-color 0.15s ease',
          fontFamily: 'inherit',
          ...style,
        }}
        className={className}
        {...props}
      />
      {error && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>{error}</span>
      )}
      {!error && helperText && (
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{helperText}</span>
      )}
    </div>
  );
};
