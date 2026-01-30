import { describe, it, expect } from 'vitest';
import { countHolidayWorkdays } from '../dates';
import type { Holiday } from '@/types/domain';

function makeHoliday(
  startDate: string,
  endDate: string,
  name = 'Test Holiday',
): Holiday {
  return { id: `h_${startDate}`, name, startDate, endDate };
}

describe('countHolidayWorkdays', () => {
  it('returns 0 for empty holidays array', () => {
    expect(countHolidayWorkdays('2026-05-01', '2026-05-31', [])).toBe(0);
  });

  it('counts a single weekday holiday', () => {
    // Memorial Day 2026 is Monday May 25
    const holidays = [makeHoliday('2026-05-25', '2026-05-25', 'Memorial Day')];
    expect(countHolidayWorkdays('2026-05-01', '2026-05-31', holidays)).toBe(1);
  });

  it('skips a holiday that falls on a Saturday', () => {
    // July 4, 2026 is a Saturday
    const holidays = [makeHoliday('2026-07-04', '2026-07-04', 'Independence Day')];
    expect(countHolidayWorkdays('2026-07-01', '2026-07-31', holidays)).toBe(0);
  });

  it('skips a holiday that falls on a Sunday', () => {
    // July 5, 2026 is a Sunday
    const holidays = [makeHoliday('2026-07-05', '2026-07-05')];
    expect(countHolidayWorkdays('2026-07-01', '2026-07-31', holidays)).toBe(0);
  });

  it('counts multi-day holiday range (Thanksgiving + day after)', () => {
    // Thanksgiving 2026: Thursday Nov 26
    // Day after: Friday Nov 27
    const holidays = [makeHoliday('2026-11-26', '2026-11-27', 'Thanksgiving')];
    expect(countHolidayWorkdays('2026-11-01', '2026-11-30', holidays)).toBe(2);
  });

  it('counts only weekday days within a range spanning a weekend', () => {
    // Dec 24-27, 2026: Thu(24), Fri(25), Sat(26), Sun(27) → 2 weekday holidays
    const holidays = [makeHoliday('2026-12-24', '2026-12-27', 'Holiday Break')];
    expect(countHolidayWorkdays('2026-12-01', '2026-12-31', holidays)).toBe(2);
  });

  it('returns 0 when holiday is entirely outside the date range', () => {
    const holidays = [makeHoliday('2026-12-25', '2026-12-25', 'Christmas')];
    expect(countHolidayWorkdays('2026-06-01', '2026-06-30', holidays)).toBe(0);
  });

  it('clips holiday to the date range (partial overlap at start)', () => {
    // Holiday spans May 29-Jun 3, but range is Jun 1-30
    // Jun 1 is Monday, Jun 2 is Tuesday, Jun 3 is Wednesday → 3 weekday holidays in range
    const holidays = [makeHoliday('2026-05-29', '2026-06-03')];
    expect(countHolidayWorkdays('2026-06-01', '2026-06-30', holidays)).toBe(3);
  });

  it('clips holiday to the date range (partial overlap at end)', () => {
    // Holiday spans Jun 29-Jul 3, range is Jun 1-30
    // Jun 29 Mon, Jun 30 Tue → 2 weekday holidays in range
    const holidays = [makeHoliday('2026-06-29', '2026-07-03')];
    expect(countHolidayWorkdays('2026-06-01', '2026-06-30', holidays)).toBe(2);
  });

  it('counts multiple non-overlapping holidays correctly', () => {
    const holidays = [
      makeHoliday('2026-05-25', '2026-05-25', 'Memorial Day'),   // Mon
      makeHoliday('2026-05-19', '2026-05-19', 'Other Holiday'),  // Tue
    ];
    expect(countHolidayWorkdays('2026-05-01', '2026-05-31', holidays)).toBe(2);
  });

  it('deduplicates overlapping holiday ranges', () => {
    // Two holidays that both cover May 25 (Monday)
    const holidays = [
      makeHoliday('2026-05-25', '2026-05-26', 'Holiday A'),
      makeHoliday('2026-05-25', '2026-05-25', 'Holiday B'),
    ];
    // Should count 2 unique weekdays (May 25 Mon, May 26 Tue), not 3
    expect(countHolidayWorkdays('2026-05-01', '2026-05-31', holidays)).toBe(2);
  });

  it('handles holiday exactly at date range boundaries', () => {
    // Range is exactly May 25 to May 25 (single day)
    const holidays = [makeHoliday('2026-05-25', '2026-05-25')]; // Monday
    expect(countHolidayWorkdays('2026-05-25', '2026-05-25', holidays)).toBe(1);
  });

  it('handles holiday with endDate before startDate in range (no match)', () => {
    // Range is Jun 15-30, holiday is Jun 1-10 → no overlap
    const holidays = [makeHoliday('2026-06-01', '2026-06-10')];
    expect(countHolidayWorkdays('2026-06-15', '2026-06-30', holidays)).toBe(0);
  });

  it('handles holiday covering entire month', () => {
    // All of June 2026 is a holiday — June has 22 workdays
    const holidays = [makeHoliday('2026-06-01', '2026-06-30', 'All June Off')];
    expect(countHolidayWorkdays('2026-06-01', '2026-06-30', holidays)).toBe(22);
  });

  it('handles single-day range with a matching holiday', () => {
    // Single day range, single day holiday, both are the same weekday
    const holidays = [makeHoliday('2026-06-15', '2026-06-15')]; // Monday
    expect(countHolidayWorkdays('2026-06-15', '2026-06-15', holidays)).toBe(1);
  });
});
