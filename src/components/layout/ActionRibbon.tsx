'use client';

import React from 'react';

export interface ActionRibbonProps {
  title: string;
  subtitle?: string;
  statusBadge?: React.ReactNode;
  leftActions?: React.ReactNode;
  rightActions?: React.ReactNode;
}

export const ActionRibbon: React.FC<ActionRibbonProps> = ({
  title,
  subtitle,
  statusBadge,
  leftActions,
  rightActions,
}) => {
  return (
    <div className="erp-ribbon">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </h2>
            {statusBadge}
          </div>
          {subtitle && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {subtitle}
            </span>
          )}
        </div>
        {leftActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
            {leftActions}
          </div>
        )}
      </div>

      {rightActions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {rightActions}
        </div>
      )}
    </div>
  );
};
