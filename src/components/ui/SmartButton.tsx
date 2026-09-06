'use client';

import React from 'react';
import Link from 'next/link';

export interface SmartButtonProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}

export const SmartButton: React.FC<SmartButtonProps> = ({
  label,
  value,
  subtext,
  icon,
  href,
  onClick,
  active = false,
}) => {
  const content = (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.625rem 1rem',
        backgroundColor: active ? 'var(--color-primary-light)' : '#ffffff',
        border: `1px solid ${active ? 'var(--color-primary-border)' : 'var(--border-color)'}`,
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        minWidth: '140px',
        boxShadow: 'var(--shadow-sm)',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--color-primary-border)';
          e.currentTarget.style.backgroundColor = '#fcfdff';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border-color)';
          e.currentTarget.style.backgroundColor = '#ffffff';
        }
      }}
    >
      {icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: active ? 'var(--color-primary)' : 'var(--color-primary-light)',
            color: active ? '#ffffff' : 'var(--color-primary)',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {value}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {label}
        </span>
        {subtext && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }

  return content;
};
