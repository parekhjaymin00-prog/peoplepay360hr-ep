'use client';

import React from 'react';
import { SalaryRuleLine } from '@/types/payroll.types';
import { formatCurrency } from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';

export interface PayslipBreakdownTableProps {
  ruleLines: SalaryRuleLine[];
  netSalary: number;
  grossSalary: number;
  totalDeductions: number;
}

export const PayslipBreakdownTable: React.FC<PayslipBreakdownTableProps> = ({
  ruleLines,
  netSalary,
  grossSalary,
  totalDeductions,
}) => {
  // Sort rule lines by sequence
  const sortedLines = [...ruleLines].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="erp-table-wrapper">
      <table className="erp-table">
        <thead>
          <tr>
            <th style={{ width: '80px' }}>Seq</th>
            <th style={{ width: '120px' }}>Code</th>
            <th>Rule Description</th>
            <th style={{ width: '130px' }}>Category</th>
            <th style={{ textAlign: 'right', width: '140px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sortedLines.map((line) => {
            const isDeduction = line.category === 'deduction';
            const isGross = line.category === 'gross';
            const isNet = line.category === 'net';

            let rowBg = 'transparent';
            let fontWeight = 400;

            if (isGross) {
              rowBg = '#f8fafc';
              fontWeight = 600;
            } else if (isNet) {
              rowBg = 'var(--color-primary-light)';
              fontWeight = 700;
            }

            return (
              <tr key={line.ruleCode} style={{ backgroundColor: rowBg }}>
                <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{line.sequence}</td>
                <td>
                  <code
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8125rem',
                      backgroundColor: '#f1f5f9',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {line.ruleCode}
                  </code>
                </td>
                <td style={{ fontWeight }}>{line.ruleName}</td>
                <td>
                  <Badge variant={isDeduction ? 'danger' : isNet ? 'purple' : isGross ? 'info' : 'success'}>
                    {line.category}
                  </Badge>
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    fontWeight: isGross || isNet ? 700 : 500,
                    color: isDeduction ? 'var(--color-danger)' : isNet ? 'var(--color-primary)' : 'var(--text-primary)',
                  }}
                >
                  {isDeduction ? `-${formatCurrency(line.amount)}` : formatCurrency(line.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary Footer */}
      <div
        style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '2rem',
          fontSize: '0.875rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Gross Earnings: </span>
          <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(grossSalary)}</strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Total Deductions: </span>
          <strong style={{ color: 'var(--color-danger)' }}>-{formatCurrency(totalDeductions)}</strong>
        </div>
        <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Net Payable: </span>
          <strong style={{ color: 'var(--color-primary)', fontSize: '1.125rem' }}>
            {formatCurrency(netSalary)}
          </strong>
        </div>
      </div>
    </div>
  );
};
