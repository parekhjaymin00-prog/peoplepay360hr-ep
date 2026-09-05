'use client';

import React from 'react';
import { AlertCircle, FileQuestion, Lock, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface StateContainerProps {
  type: 'loading' | 'empty' | 'error' | 'unauthorized';
  title?: string;
  description?: string;
  onRetry?: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const StateContainer: React.FC<StateContainerProps> = ({
  type,
  title,
  description,
  onRetry,
  actionText,
  onAction,
}) => {
  if (type === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          color: 'var(--text-muted)',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '2.5rem',
            height: '2.5rem',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>
          {description || 'Loading records...'}
        </p>
      </div>
    );
  }

  if (type === 'empty') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--border-color)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
          }}
        >
          <FileQuestion size={24} />
        </div>
        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          {title || 'No records found'}
        </h4>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', maxWidth: '360px', marginBottom: '1.25rem' }}>
          {description || 'There are currently no items matching your criteria in this view.'}
        </p>
        {actionText && onAction && (
          <Button variant="primary" size="sm" onClick={onAction}>
            {actionText}
          </Button>
        )}
      </div>
    );
  }

  if (type === 'unauthorized') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 2rem',
          textAlign: 'center',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-danger-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-danger)',
            marginBottom: '1rem',
          }}
        >
          <Lock size={24} />
        </div>
        <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          {title || 'Access Restricted'}
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '420px', marginBottom: '1.5rem' }}>
          {description || 'Your current user role does not have authorization to view or configure this module. Switch roles in the top bar to inspect other role views.'}
        </p>
        {actionText && onAction && (
          <Button variant="secondary" size="md" onClick={onAction}>
            {actionText}
          </Button>
        )}
      </div>
    );
  }

  // Error State
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem 2rem',
        textAlign: 'center',
        backgroundColor: 'var(--color-danger-light)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-danger-border)',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-danger)',
          marginBottom: '0.75rem',
        }}
      >
        <AlertCircle size={22} />
      </div>
      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-danger-text)', marginBottom: '0.25rem' }}>
        {title || 'Unable to load data'}
      </h4>
      <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger-text)', opacity: 0.85, maxWidth: '380px', marginBottom: '1rem' }}>
        {description || 'An unexpected error occurred while communicating with the backend API service.'}
      </p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw size={14} />}
        >
          Retry Request
        </Button>
      )}
    </div>
  );
};

export const LoadingState: React.FC<{ description?: string }> = ({ description }) => (
  <StateContainer type="loading" description={description} />
);

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}> = (props) => <StateContainer type="empty" {...props} />;

export const ErrorState: React.FC<{
  title?: string;
  description?: string;
  onRetry?: () => void;
}> = (props) => <StateContainer type="error" {...props} />;

export const UnauthorizedState: React.FC<{
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}> = (props) => <StateContainer type="unauthorized" {...props} />;

export const RetryButton: React.FC<{ onRetry: () => void; text?: string }> = ({
  onRetry,
  text = 'Retry Request',
}) => (
  <Button variant="outline" size="sm" onClick={onRetry} leftIcon={<RefreshCw size={14} />}>
    {text}
  </Button>
);

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: '440px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
