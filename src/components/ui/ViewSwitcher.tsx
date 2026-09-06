'use client';

import React from 'react';
import { LayoutGrid, List } from 'lucide-react';
import { ViewMode } from '@/types/common.types';

export interface ViewSwitcherProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  currentMode,
  onModeChange,
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: '#f1f5f9',
        padding: '0.2rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        gap: '0.2rem',
      }}
    >
      <button
        onClick={() => onModeChange('list')}
        title="List View"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '30px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          backgroundColor: currentMode === 'list' ? '#ffffff' : 'transparent',
          color: currentMode === 'list' ? 'var(--color-primary)' : 'var(--text-secondary)',
          boxShadow: currentMode === 'list' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <List size={16} />
      </button>

      <button
        onClick={() => onModeChange('kanban')}
        title="Kanban Cards View"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '30px',
          borderRadius: 'var(--radius-sm)',
          border: 'none',
          backgroundColor: currentMode === 'kanban' ? '#ffffff' : 'transparent',
          color: currentMode === 'kanban' ? 'var(--color-primary)' : 'var(--text-secondary)',
          boxShadow: currentMode === 'kanban' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <LayoutGrid size={16} />
      </button>
    </div>
  );
};
