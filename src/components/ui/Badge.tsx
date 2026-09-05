'use client';

import React from 'react';

export interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';
  status?: string;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant,
  status,
  size = 'md',
}) => {
  // Infer variant from status string if variant is not explicitly provided
  let effectiveVariant = variant;
  if (!effectiveVariant && status) {
    const s = status.toLowerCase();
    if (['running', 'active', 'approved', 'paid', 'normal', 'success'].includes(s)) {
      effectiveVariant = 'success';
    } else if (['draft', 'submitted', 'late', 'warning', 'computed'].includes(s)) {
      effectiveVariant = 'warning';
    } else if (['expired', 'refused', 'cancelled', 'missing_checkout', 'danger'].includes(s)) {
      effectiveVariant = 'danger';
    } else if (['validated', 'info', 'manual_edit', 'overtime'].includes(s)) {
      effectiveVariant = 'info';
    } else {
      effectiveVariant = 'neutral';
    }
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    success: {
      backgroundColor: 'var(--color-success-light)',
      color: 'var(--color-success-text)',
      border: '1px solid var(--color-success-border)',
    },
    warning: {
      backgroundColor: 'var(--color-warning-light)',
      color: 'var(--color-warning-text)',
      border: '1px solid var(--color-warning-border)',
    },
    danger: {
      backgroundColor: 'var(--color-danger-light)',
      color: 'var(--color-danger-text)',
      border: '1px solid var(--color-danger-border)',
    },
    info: {
      backgroundColor: 'var(--color-info-light)',
      color: 'var(--color-info-text)',
      border: '1px solid var(--color-info-border)',
    },
    neutral: {
      backgroundColor: '#f1f5f9',
      color: '#475569',
      border: '1px solid #e2e8f0',
    },
    purple: {
      backgroundColor: '#f5f3ff',
      color: '#6b21a8',
      border: '1px solid #ddd6fe',
    },
  };

  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    borderRadius: '9999px',
    fontWeight: 500,
    fontSize: size === 'sm' ? '0.6875rem' : '0.75rem',
    padding: size === 'sm' ? '0.15rem 0.5rem' : '0.2rem 0.65rem',
    textTransform: 'capitalize',
    ...(variantStyles[effectiveVariant || 'neutral']),
  };

  return <span style={style}>{children || status}</span>;
};
