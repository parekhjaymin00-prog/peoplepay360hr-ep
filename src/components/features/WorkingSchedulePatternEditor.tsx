'use client';

import React, { useState } from 'react';
import { ScheduleDayPattern } from '@/types/attendance.types';
import { Card } from '@/components/ui/Card';
import { formatHours } from '@/lib/formatters';

export interface WorkingSchedulePatternEditorProps {
  initialPatterns?: ScheduleDayPattern[];
  onChange?: (patterns: ScheduleDayPattern[], totalHours: number) => void;
}

const DEFAULT_PATTERNS: ScheduleDayPattern[] = [
  { day: 'monday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
  { day: 'tuesday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
  { day: 'wednesday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
  { day: 'thursday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
  { day: 'friday', active: true, startTime: '09:00', endTime: '18:00', breakHours: 1.0 },
  { day: 'saturday', active: false, startTime: '09:00', endTime: '13:00', breakHours: 0.0 },
  { day: 'sunday', active: false, startTime: '09:00', endTime: '13:00', breakHours: 0.0 },
];

function calculateDayHours(start: string, end: string, breakH: number): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startDec = sh + sm / 60;
  const endDec = eh + em / 60;
  const total = Math.max(0, endDec - startDec - breakH);
  return Math.round(total * 100) / 100;
}

export const WorkingSchedulePatternEditor: React.FC<WorkingSchedulePatternEditorProps> = ({
  initialPatterns = DEFAULT_PATTERNS,
  onChange,
}) => {
  const [patterns, setPatterns] = useState<ScheduleDayPattern[]>(initialPatterns);

  const calculateTotalWeeklyHours = (items: ScheduleDayPattern[]) => {
    return items.reduce((acc, curr) => {
      if (!curr.active) return acc;
      return acc + calculateDayHours(curr.startTime, curr.endTime, curr.breakHours);
    }, 0);
  };

  const totalWeekly = calculateTotalWeeklyHours(patterns);

  const updatePattern = (index: number, updates: Partial<ScheduleDayPattern>) => {
    const next = [...patterns];
    next[index] = { ...next[index], ...updates };
    setPatterns(next);
    if (onChange) {
      onChange(next, calculateTotalWeeklyHours(next));
    }
  };

  return (
    <Card padding="md">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Weekly Working Hours Pattern
          </h4>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Set work shifts per day. Total weekly hours are calculated automatically from times & breaks.
          </p>
        </div>
        <div
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-border)',
            textAlign: 'right',
          }}
        >
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
            Calculated Total
          </span>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
            {formatHours(totalWeekly)} / week
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {patterns.map((item, idx) => {
          const hours = item.active
            ? calculateDayHours(item.startTime, item.endTime, item.breakHours)
            : 0;

          return (
            <div
              key={item.day}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.625rem 1rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: item.active ? '#ffffff' : '#f8fafc',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Active Toggle & Day */}
              <div style={{ width: '130px', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) => updatePattern(idx, { active: e.target.checked })}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'capitalize' }}>
                  {item.day}
                </span>
              </div>

              {/* Start Time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Start:</span>
                <input
                  type="time"
                  disabled={!item.active}
                  value={item.startTime}
                  onChange={(e) => updatePattern(idx, { startTime: e.target.value })}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              {/* End Time */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>End:</span>
                <input
                  type="time"
                  disabled={!item.active}
                  value={item.endTime}
                  onChange={(e) => updatePattern(idx, { endTime: e.target.value })}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8125rem',
                  }}
                />
              </div>

              {/* Break Hours */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Break:</span>
                <select
                  disabled={!item.active}
                  value={item.breakHours}
                  onChange={(e) => updatePattern(idx, { breakHours: parseFloat(e.target.value) })}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="0">0h</option>
                  <option value="0.5">30 min</option>
                  <option value="1">1 hour</option>
                  <option value="1.5">1.5 hours</option>
                </select>
              </div>

              {/* Calculated day hours */}
              <div style={{ marginLeft: 'auto', textAlign: 'right', minWidth: '90px' }}>
                <span
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: item.active ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {item.active ? `${hours} hrs` : 'Off'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
