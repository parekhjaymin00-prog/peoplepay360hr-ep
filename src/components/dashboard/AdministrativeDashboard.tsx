'use client';

import React, { useEffect, useState } from 'react';
import { payrollService } from '@/services/payroll.service';
import { PayrollDashboardMetrics } from '@/types/payroll.types';
import { UserRole } from '@/types/auth.types';
import { formatCurrency } from '@/lib/formatters';
import { Card } from '@/components/ui/Card';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { StateContainer } from '@/components/ui/StateContainer';
import {
  DollarSign,
  FileSpreadsheet,
  TrendingUp,
  CalendarCheck,
  Activity,
  Filter,
  Info,
  Users,
  FileText,
  Clock,
} from 'lucide-react';

interface AdministrativeDashboardProps {
  role?: UserRole;
}

export const AdministrativeDashboard: React.FC<AdministrativeDashboardProps> = ({ role = 'hr_payroll_manager' }) => {
  const [metrics, setMetrics] = useState<PayrollDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('2026-03');
  const [selectedDepartment, setSelectedDepartment] = useState('all');

  // Determine whether this administrative view has payroll oversight
  const isHRManagerOnly = role === 'hr_manager';

  const loadMetrics = () => {
    setLoading(true);
    setError(null);
    payrollService
      .getDashboardMetrics()
      .then((res) => {
        if (res.success && res.data) {
          setMetrics(res.data);
        } else {
          setError(res.error || 'Administrative metrics are currently unavailable from the backend API.');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Network communication failure connecting to payroll metrics API.');
        setLoading(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    payrollService
      .getDashboardMetrics()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setMetrics(res.data);
          setError(null);
        } else {
          setError(res.error || 'Administrative metrics are currently unavailable from the backend API.');
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setError('Network communication failure connecting to payroll metrics API.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPeriod, selectedDepartment]);

  if (loading) {
    return <StateContainer type="loading" description="Loading administrative operational metrics..." />;
  }

  if (error || !metrics) {
    return (
      <div style={{ marginTop: '1.5rem' }}>
        <StateContainer
          type="empty"
          title="Administrative Dashboard Metrics Unavailable"
          description={error || 'Dashboard operational metrics have not been aggregated yet by the backend service.'}
          onRetry={loadMetrics}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // HR Manager View (Strictly HR Operations, Zero Payroll Admin)
  // -------------------------------------------------------------
  if (isHRManagerOnly) {
    const hrKpis = [
      {
        title: 'Active Employees',
        value: '24 Staff',
        subtext: 'Across 5 departments',
        icon: <Users size={20} />,
        color: '#4f46e5',
        bg: '#eef2ff',
      },
      {
        title: 'Attendance Health',
        value: `${metrics.attendanceHealthRate}%`,
        subtext: 'Expected schedule hours',
        icon: <Activity size={20} />,
        color: '#7c3aed',
        bg: '#f5f3ff',
      },
      {
        title: 'Approved Time Off',
        value: `${metrics.approvedTimeOffDays} Days`,
        subtext: 'Consumed this cycle',
        icon: <CalendarCheck size={20} />,
        color: '#d97706',
        bg: '#fffbeb',
      },
      {
        title: 'Active Contracts',
        value: '22 Running',
        subtext: '2 pending renewals',
        icon: <FileText size={20} />,
        color: '#0284c7',
        bg: '#f0f9ff',
      },
      {
        title: 'Pending Leave Approvals',
        value: '3 Requests',
        subtext: 'Awaiting manager action',
        icon: <Clock size={20} />,
        color: '#059669',
        bg: '#ecfdf5',
      },
    ];

    const hrAlerts = [
      '2 Employee contracts approaching expiry within 30 days (requires HR review)',
      '3 Pending leave requests awaiting supervisor review in Time Off module',
      '1 Employee record missing assigned working schedule definition',
    ];

    return (
      <div>
        {/* Sample Presentation Data Disclaimer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 1rem',
            backgroundColor: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: '1.25rem',
          }}
        >
          <Info size={14} color="var(--color-info)" />
          <span>
            <strong>Development Preview:</strong> Showing sample presentation metrics for HR operational evaluation. Backend services will compute authoritative numbers during final integration.
          </span>
        </div>

        {/* Header & Filter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              HR Operations Dashboard
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Operational overview across Employee records, Attendance, Contracts, and Leave allocations
            </p>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#ffffff',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Filter size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8125rem', outline: 'none' }}
              >
                <option value="2026-03">March 2026</option>
                <option value="2026-02">February 2026</option>
                <option value="2026-01">January 2026</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: '#ffffff',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dept:</span>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                style={{ border: 'none', background: 'transparent', fontSize: '0.8125rem', outline: 'none' }}
              >
                <option value="all">All Departments</option>
                <option value="engineering">Engineering</option>
                <option value="product">Product & Design</option>
                <option value="executive">Executive</option>
                <option value="finance">Finance & Payroll</option>
              </select>
            </div>
          </div>
        </div>

        {/* HR Attention Items */}
        <div style={{ marginBottom: '1.5rem' }}>
          <WarningBanner
            type="warning"
            title="HR Operational Attention Items"
            items={hrAlerts}
          />
        </div>

        {/* HR KPI Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          {hrKpis.map((kpi, idx) => (
            <Card key={idx} padding="md">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                    {kpi.title}
                  </span>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                    {kpi.value}
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {kpi.subtext}
                  </span>
                </div>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: kpi.bg,
                    color: kpi.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {kpi.icon}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Department Headcount & Attendance Health Breakdown */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Department Headcount Distribution */}
          <Card padding="md">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Department Headcount Distribution
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Total active staff distributed across operational units
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {metrics.departmentExpenditure.map((dept) => {
                const maxStaff = 16;
                const barWidth = Math.min(100, Math.round((dept.headcount / maxStaff) * 100));

                return (
                  <div key={dept.department}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {dept.department}
                      </span>
                      <strong style={{ color: 'var(--color-primary)' }}>{dept.headcount} Staff</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${barWidth}%`,
                          height: '100%',
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: '4px',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Attendance & Presence Quality Health */}
          <Card padding="md">
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Monthly Attendance Quality Trajectory
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Historical scheduled hours compliance across organization
            </p>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', paddingTop: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              {[
                { month: 'Oct', rate: 91 },
                { month: 'Nov', rate: 93 },
                { month: 'Dec', rate: 89 },
                { month: 'Jan', rate: 94 },
                { month: 'Feb', rate: 92 },
                { month: 'Mar', rate: 95 },
              ].map((item) => (
                <div
                  key={item.month}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', flex: 1 }}
                >
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {item.rate}%
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: `${item.rate}%`,
                      backgroundColor: item.month === 'Mar' ? 'var(--color-primary)' : '#c7d2fe',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {item.month}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // Payroll & HR Executive Dashboard (for HR Payroll User / Manager / Admin)
  // -------------------------------------------------------------
  const kpis = [
    {
      title: 'Total Net Salary Paid',
      value: formatCurrency(metrics.totalNetSalaryPaid),
      subtext: 'March 2026 period',
      icon: <DollarSign size={20} />,
      color: '#4f46e5',
      bg: '#eef2ff',
    },
    {
      title: 'Payslips Generated',
      value: metrics.payslipsGenerated,
      subtext: 'Active batch count',
      icon: <FileSpreadsheet size={20} />,
      color: '#0284c7',
      bg: '#f0f9ff',
    },
    {
      title: 'Average Net Salary',
      value: formatCurrency(metrics.averageSalary),
      subtext: 'Per eligible employee',
      icon: <TrendingUp size={20} />,
      color: '#059669',
      bg: '#ecfdf5',
    },
    {
      title: 'Approved Time Off',
      value: `${metrics.approvedTimeOffDays} Days`,
      subtext: 'Consumed this cycle',
      icon: <CalendarCheck size={20} />,
      color: '#d97706',
      bg: '#fffbeb',
    },
    {
      title: 'Attendance Health',
      value: `${metrics.attendanceHealthRate}%`,
      subtext: 'Expected schedule hours',
      icon: <Activity size={20} />,
      color: '#7c3aed',
      bg: '#f5f3ff',
    },
  ];

  return (
    <div>
      {/* Sample Presentation Data Disclaimer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 1rem',
          backgroundColor: '#f1f5f9',
          border: '1px solid #e2e8f0',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginBottom: '1.25rem',
        }}
      >
        <Info size={14} color="var(--color-info)" />
        <span>
          <strong>Development Preview:</strong> Showing sample presentation metrics for administrative UI evaluation. Backend services will compute authoritative numbers during final integration.
        </span>
      </div>

      {/* Header & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Payroll & HR Executive Dashboard
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Organizational metrics across Employee records, Attendance, Time Off, Contracts, and Payruns
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <Filter size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Period:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.8125rem', outline: 'none' }}
            >
              <option value="2026-03">March 2026</option>
              <option value="2026-02">February 2026</option>
              <option value="2026-01">January 2026</option>
            </select>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#ffffff',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Dept:</span>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              style={{ border: 'none', background: 'transparent', fontSize: '0.8125rem', outline: 'none' }}
            >
              <option value="all">All Departments</option>
              <option value="engineering">Engineering</option>
              <option value="product">Product & Design</option>
              <option value="executive">Executive</option>
              <option value="finance">Finance & Payroll</option>
            </select>
          </div>
        </div>
      </div>

      {/* Operational Alerts Box */}
      {metrics.activePayrunWarnings.length > 0 && (
        <WarningBanner
          type="warning"
          title="Operational Attention Items (Review Prior to Payrun Finalization)"
          items={metrics.activePayrunWarnings}
        />
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {kpis.map((kpi, idx) => (
          <Card key={idx} padding="md">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {kpi.title}
                </span>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                  {kpi.value}
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  {kpi.subtext}
                </span>
              </div>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: kpi.bg,
                  color: kpi.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {kpi.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Department Breakdown & Monthly Trends */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Department Breakdown */}
        <Card padding="md">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Department Salary Expenditure & Headcount
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Aggregated payroll costs mapped to operational departments
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {metrics.departmentExpenditure.map((dept) => {
              const maxCost = 14000;
              const barWidth = Math.min(100, Math.round((dept.totalCost / maxCost) * 100));

              return (
                <div key={dept.department}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {dept.department}{' '}
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                        ({dept.headcount} staff)
                      </span>
                    </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(dept.totalCost)}</strong>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        backgroundColor: 'var(--color-primary)',
                        borderRadius: '4px',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Monthly Net Salary Trend */}
        <Card padding="md">
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Monthly Payroll Expenditure Trends
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Sample 6-month trajectory of net salaries disbursed
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', paddingTop: '1rem', borderBottom: '1px solid var(--border-color)' }}>
            {metrics.monthlyNetSalaryTrends.map((trend) => {
              const maxVal = 40000;
              const heightPct = Math.round((trend.amount / maxVal) * 100);

              return (
                <div
                  key={trend.month}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', flex: 1 }}
                >
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    ${Math.round(trend.amount / 1000)}k
                  </span>
                  <div
                    style={{
                      width: '28px',
                      height: `${heightPct}%`,
                      backgroundColor: trend.month === 'Mar 2026' ? 'var(--color-primary)' : '#c7d2fe',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                    {trend.month.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
};
