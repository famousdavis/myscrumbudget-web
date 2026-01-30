import { describe, it, expect } from 'vitest';
import {
  generateMonthRange,
  formatMonthLabel,
  formatShortMonth,
  nextBusinessDay,
  countWorkdays,
  getMonthlyWorkHours,
} from '../dates';
import type { Holiday } from '@/types/domain';

describe('generateMonthRange', () => {
  it('generates a single month when start equals end', () => {
    expect(generateMonthRange('2026-06', '2026-06')).toEqual(['2026-06']);
  });

  it('generates consecutive months within the same year', () => {
    expect(generateMonthRange('2026-06', '2026-09')).toEqual([
      '2026-06', '2026-07', '2026-08', '2026-09',
    ]);
  });

  it('spans across a year boundary', () => {
    expect(generateMonthRange('2026-11', '2027-02')).toEqual([
      '2026-11', '2026-12', '2027-01', '2027-02',
    ]);
  });

  it('generates 14 months for the golden-file project range', () => {
    const months = generateMonthRange('2026-06', '2027-07');
    expect(months).toHaveLength(14);
    expect(months[0]).toBe('2026-06');
    expect(months[13]).toBe('2027-07');
  });

  it('returns empty array when start is after end', () => {
    expect(generateMonthRange('2027-01', '2026-06')).toEqual([]);
  });

  it('pads single-digit months with leading zero', () => {
    const months = generateMonthRange('2026-01', '2026-03');
    expect(months).toEqual(['2026-01', '2026-02', '2026-03']);
  });
});

describe('formatMonthLabel', () => {
  it('formats YYYY-MM as "Mon YYYY"', () => {
    expect(formatMonthLabel('2026-06')).toBe('Jun 2026');
    expect(formatMonthLabel('2026-01')).toBe('Jan 2026');
    expect(formatMonthLabel('2026-12')).toBe('Dec 2026');
  });
});

describe('formatShortMonth', () => {
  it('returns 3-letter month abbreviation', () => {
    expect(formatShortMonth('2026-01')).toBe('Jan');
    expect(formatShortMonth('2026-06')).toBe('Jun');
    expect(formatShortMonth('2026-12')).toBe('Dec');
  });
});

describe('nextBusinessDay', () => {
  it('returns the next day when current is a weekday before Friday', () => {
    // Monday → Tuesday
    expect(nextBusinessDay('2026-01-05')).toBe('2026-01-06');
  });

  it('skips weekend when current is Friday', () => {
    // Friday → Monday
    expect(nextBusinessDay('2026-01-09')).toBe('2026-01-12');
  });

  it('skips to Monday when current is Saturday', () => {
    // Saturday → Monday
    expect(nextBusinessDay('2026-01-10')).toBe('2026-01-12');
  });

  it('returns Monday when current is Sunday', () => {
    // Sunday → next day is Monday
    expect(nextBusinessDay('2026-01-04')).toBe('2026-01-05');
  });

  it('handles month boundary', () => {
    // Friday Jan 30 → Monday Feb 2
    expect(nextBusinessDay('2026-01-30')).toBe('2026-02-02');
  });
});

describe('countWorkdays', () => {
  it('counts 2 workdays for Thu-Fri range (1/29-1/30/2026)', () => {
    expect(countWorkdays('2026-01-29', '2026-01-30')).toBe(2);
  });

  it('counts 22 workdays in January 2026 (starts Thu)', () => {
    expect(countWorkdays('2026-01-01', '2026-01-31')).toBe(22);
  });

  it('counts 20 workdays in February 2026 (starts Sun)', () => {
    expect(countWorkdays('2026-02-01', '2026-02-28')).toBe(20);
  });

  it('counts 22 workdays in June 2026 (starts Mon)', () => {
    expect(countWorkdays('2026-06-01', '2026-06-30')).toBe(22);
  });

  it('counts 1 workday for a single weekday', () => {
    expect(countWorkdays('2026-01-05', '2026-01-05')).toBe(1); // Monday
  });

  it('counts 0 workdays for a single Saturday', () => {
    expect(countWorkdays('2026-01-03', '2026-01-03')).toBe(0); // Saturday
  });

  it('counts 0 workdays for a single Sunday', () => {
    expect(countWorkdays('2026-01-04', '2026-01-04')).toBe(0); // Sunday
  });

  it('counts 0 workdays for a Sat-Sun weekend', () => {
    expect(countWorkdays('2026-01-03', '2026-01-04')).toBe(0);
  });

  it('counts 5 workdays for a full Mon-Fri week', () => {
    expect(countWorkdays('2026-01-05', '2026-01-09')).toBe(5);
  });

  it('counts 12 workdays from June 15-30, 2026 (Mon-Tue)', () => {
    // June 15 is Monday, June 30 is Tuesday
    expect(countWorkdays('2026-06-15', '2026-06-30')).toBe(12);
  });

  it('counts 11 workdays from July 1-15, 2027 (Thu-Tue)', () => {
    // July 1 is Thursday, July 15 is Thursday
    expect(countWorkdays('2027-07-01', '2027-07-15')).toBe(11);
  });
});

describe('getMonthlyWorkHours', () => {
  it('returns full-month hours for a middle month', () => {
    // July 2026 has 23 workdays = 184 hours
    expect(getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15')).toBe(184);
  });

  it('clips first month to project start date', () => {
    // June 2026, project starts 6/15: 12 workdays * 8 = 96 hours
    expect(getMonthlyWorkHours('2026-06', '2026-06-15', '2027-07-15')).toBe(96);
  });

  it('clips last month to project end date', () => {
    // July 2027, project ends 7/15: 11 workdays * 8 = 88 hours
    expect(getMonthlyWorkHours('2027-07', '2026-06-15', '2027-07-15')).toBe(88);
  });

  it('handles a 2-day project within a single month', () => {
    // 1/29-1/30/2026: 2 workdays * 8 = 16 hours
    expect(getMonthlyWorkHours('2026-01', '2026-01-29', '2026-01-30')).toBe(16);
  });

  it('returns 0 for a month outside the project date range', () => {
    expect(getMonthlyWorkHours('2026-05', '2026-06-15', '2027-07-15')).toBe(0);
    expect(getMonthlyWorkHours('2027-08', '2026-06-15', '2027-07-15')).toBe(0);
  });

  it('handles a full-month project (Jan 2026)', () => {
    // 22 workdays * 8 = 176
    expect(getMonthlyWorkHours('2026-01', '2026-01-01', '2026-01-31')).toBe(176);
  });

  it('handles February 2026 (20 workdays)', () => {
    expect(getMonthlyWorkHours('2026-02', '2026-01-01', '2026-12-31')).toBe(160);
  });

  it('varies month-to-month based on calendar', () => {
    const jan = getMonthlyWorkHours('2026-01', '2026-01-01', '2026-12-31');
    const feb = getMonthlyWorkHours('2026-02', '2026-01-01', '2026-12-31');
    // January has 22 workdays, February has 20
    expect(jan).toBe(176);
    expect(feb).toBe(160);
    expect(jan).not.toBe(feb);
  });

  it('returns same result when holidays is empty array', () => {
    const without = getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15');
    const withEmpty = getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15', []);
    expect(withEmpty).toBe(without);
  });

  it('subtracts a weekday holiday from available hours', () => {
    // Memorial Day 2026: Monday May 25
    const holidays: Holiday[] = [
      { id: 'h1', name: 'Memorial Day', startDate: '2026-05-25', endDate: '2026-05-25' },
    ];
    const without = getMonthlyWorkHours('2026-05', '2026-01-01', '2026-12-31');
    const withHoliday = getMonthlyWorkHours('2026-05', '2026-01-01', '2026-12-31', holidays);
    // May 2026 has 21 workdays; holiday removes 1 → 20 workdays → 160 hours
    expect(without).toBe(168); // 21 * 8
    expect(withHoliday).toBe(160); // 20 * 8
  });

  it('ignores a weekend holiday (no effect on hours)', () => {
    // July 4, 2026 is a Saturday
    const holidays: Holiday[] = [
      { id: 'h1', name: 'Independence Day', startDate: '2026-07-04', endDate: '2026-07-04' },
    ];
    const without = getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15');
    const withHoliday = getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15', holidays);
    expect(withHoliday).toBe(without);
  });

  it('ignores a holiday outside the project date range', () => {
    // Holiday in March 2026, but project starts June 2026
    const holidays: Holiday[] = [
      { id: 'h1', name: 'Spring Holiday', startDate: '2026-03-16', endDate: '2026-03-16' },
    ];
    const without = getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15');
    const withHoliday = getMonthlyWorkHours('2026-07', '2026-06-15', '2027-07-15', holidays);
    expect(withHoliday).toBe(without);
  });

  it('subtracts multiple holidays in one month', () => {
    // Thanksgiving 2026: Thu Nov 26 + Fri Nov 27
    const holidays: Holiday[] = [
      { id: 'h1', name: 'Thanksgiving', startDate: '2026-11-26', endDate: '2026-11-27' },
    ];
    const without = getMonthlyWorkHours('2026-11', '2026-01-01', '2026-12-31');
    const withHoliday = getMonthlyWorkHours('2026-11', '2026-01-01', '2026-12-31', holidays);
    // November 2026 has 21 workdays; 2 holidays → 19 workdays
    expect(without).toBe(168); // 21 * 8
    expect(withHoliday).toBe(152); // 19 * 8
  });

  it('handles holiday in a clipped first month', () => {
    // Project starts June 15. Holiday on June 16 (Tuesday) should be subtracted.
    const holidays: Holiday[] = [
      { id: 'h1', name: 'Company Day', startDate: '2026-06-16', endDate: '2026-06-16' },
    ];
    const without = getMonthlyWorkHours('2026-06', '2026-06-15', '2027-07-15');
    const withHoliday = getMonthlyWorkHours('2026-06', '2026-06-15', '2027-07-15', holidays);
    // June 15-30: 12 workdays without holiday, 11 with
    expect(without).toBe(96);  // 12 * 8
    expect(withHoliday).toBe(88); // 11 * 8
  });

  it('never returns negative hours even with excessive holidays', () => {
    // Project only spans Jun 15-16 (2 workdays), but holidays cover entire month
    const holidays: Holiday[] = [
      { id: 'h1', name: 'Full Month Off', startDate: '2026-06-01', endDate: '2026-06-30' },
    ];
    const result = getMonthlyWorkHours('2026-06', '2026-06-15', '2026-06-16', holidays);
    expect(result).toBe(0);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});
