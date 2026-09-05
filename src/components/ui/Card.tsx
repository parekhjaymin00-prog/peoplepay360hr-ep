'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  style,
  className = '',
  ...props
}) => {
  const paddingMap = {
    none: '0',
    sm: '0.75rem',
    md: '1.25rem',
    lg: '1.75rem',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-sm)',
    padding: paddingMap[padding],
    ...style,
  };

  return (
    <div style={cardStyle} className={className} {...props}>
      {children}
    </div>
  );
};
