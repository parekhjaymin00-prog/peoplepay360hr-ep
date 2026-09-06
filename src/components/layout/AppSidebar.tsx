'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { resolveNavigation } from '@/navigation/navigation-resolver';
import {
  LayoutDashboard,
  User,
  Users,
  Clock,
  CalendarCheck,
  CalendarClock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Layers,
  Sliders,
  Shield,
  Sparkles,
} from 'lucide-react';

export const AppSidebar: React.FC = () => {
  const pathname = usePathname();
  const { role, user } = useAuth();

  // Resolve visible navigation items dynamically via configuration resolver
  const navigationGroups = resolveNavigation(role);

  const renderIcon = (name: string) => {
    switch (name) {
      case 'LayoutDashboard': return <LayoutDashboard size={17} />;
      case 'User': return <User size={17} />;
      case 'Users': return <Users size={17} />;
      case 'Clock': return <Clock size={17} />;
      case 'CalendarCheck': return <CalendarCheck size={17} />;
      case 'CalendarClock': return <CalendarClock size={17} />;
      case 'CreditCard': return <CreditCard size={17} />;
      case 'FileSpreadsheet': return <FileSpreadsheet size={17} />;
      case 'FileText': return <FileText size={17} />;
      case 'Layers': return <Layers size={17} />;
      case 'Sliders': return <Sliders size={17} />;
      case 'Shield': return <Shield size={17} />;
      default: return <FileText size={17} />;
    }
  };

  return (
    <aside className="erp-sidebar">
      {/* Brand logo & title */}
      <div
        style={{
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0 1.25rem',
          borderBottom: '1px solid #1e293b',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 2px 4px rgba(99, 102, 241, 0.4)',
          }}
        >
          <Sparkles size={18} />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1 }}>
            PeoplePay<span style={{ color: '#818cf8' }}>360</span>
          </h1>
          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            HR & Payroll Platform
          </span>
        </div>
      </div>

      {/* Dynamic Navigation Groups */}
      <div style={{ flex: 1, padding: '1rem 0.75rem', overflowY: 'auto' }}>
        {navigationGroups.map((group) => (
          <div key={group.category.category} style={{ marginBottom: '1.25rem' }}>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 0.5rem',
                marginBottom: '0.4rem',
              }}
            >
              {group.category.label}
            </div>

            {group.items.map((item) => {
              // Dynamically route employee profile to real authenticated employee UUID
              const itemHref =
                item.id === 'emp-profile' && user?.employee?.id
                  ? `/employees/${user.employee.id}`
                  : item.href;

              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === itemHref || pathname.startsWith(`${itemHref}/`);

              return (
                <Link
                  key={item.id}
                  href={itemHref}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.7rem',
                    padding: '0.45rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '0.15rem',
                    textDecoration: 'none',
                    fontSize: '0.84rem',
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
                    color: isActive ? '#ffffff' : '#cbd5e1',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ color: isActive ? '#818cf8' : '#94a3b8' }}>
                    {renderIcon(item.iconName)}
                  </span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '0.1rem 0.35rem',
                        backgroundColor: '#334155',
                        color: '#94a3b8',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                  {item.isReadOnly && (
                    <span
                      style={{
                        fontSize: '0.625rem',
                        padding: '0.1rem 0.35rem',
                        backgroundColor: '#1e293b',
                        color: '#64748b',
                        borderRadius: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Read-Only
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer system build badge */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid #1e293b',
          fontSize: '0.6875rem',
          color: '#64748b',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>v0.1.0-alpha</span>
        <span style={{ color: '#10b981' }}>Live Backend API</span>
      </div>
    </aside>
  );
};
