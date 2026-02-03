/**
 * US Federal Holiday generator.
 *
 * Generates all 11 official US federal holidays for a given year,
 * plus their observed dates when a holiday falls on a weekend:
 *   - Saturday → observed on preceding Friday
 *   - Sunday  → observed on following Monday
 *
 * Each entry has { name, date } where date is 'YYYY-MM-DD'.
 * Observed dates are separate entries with "(Observed)" suffix.
 */

/** Format a Date as YYYY-MM-DD */
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Return the nth occurrence of a weekday (0=Sun…6=Sat) in a given month/year. n is 1-based. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  let dayOfWeek = first.getDay();
  let diff = (weekday - dayOfWeek + 7) % 7;
  const day = 1 + diff + (n - 1) * 7;
  return new Date(year, month, day);
}

/** Return the last occurrence of a weekday in a given month/year. */
function lastWeekday(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month + 1, 0); // last day of month
  let diff = (lastDay.getDay() - weekday + 7) % 7;
  return new Date(year, month, lastDay.getDate() - diff);
}

interface RawHoliday {
  name: string;
  date: Date;
}

export interface FederalHolidayEntry {
  name: string;
  date: string; // YYYY-MM-DD
}

/**
 * Compute US federal holidays for a given year.
 * Returns entries sorted by date, including observed dates when applicable.
 */
export function getUSAFederalHolidays(year: number): FederalHolidayEntry[] {
  const holidays: RawHoliday[] = [
    // Fixed-date holidays
    { name: "New Year's Day", date: new Date(year, 0, 1) },
    { name: 'Juneteenth', date: new Date(year, 5, 19) },
    { name: 'Independence Day', date: new Date(year, 6, 4) },
    { name: 'Veterans Day', date: new Date(year, 10, 11) },
    { name: 'Christmas Day', date: new Date(year, 11, 25) },

    // Floating holidays
    { name: 'Martin Luther King Jr. Day', date: nthWeekday(year, 0, 1, 3) }, // 3rd Monday Jan
    { name: "Presidents' Day", date: nthWeekday(year, 1, 1, 3) }, // 3rd Monday Feb
    { name: 'Memorial Day', date: lastWeekday(year, 4, 1) }, // Last Monday May
    { name: 'Labor Day', date: nthWeekday(year, 8, 1, 1) }, // 1st Monday Sep
    { name: 'Columbus Day', date: nthWeekday(year, 9, 1, 2) }, // 2nd Monday Oct
    { name: 'Thanksgiving Day', date: nthWeekday(year, 10, 4, 4) }, // 4th Thursday Nov
  ];

  const result: FederalHolidayEntry[] = [];

  for (const h of holidays) {
    result.push({ name: h.name, date: fmt(h.date) });

    const dow = h.date.getDay();
    if (dow === 6) {
      // Saturday → observed on preceding Friday
      const observed = new Date(h.date);
      observed.setDate(observed.getDate() - 1);
      result.push({ name: `${h.name} (Observed)`, date: fmt(observed) });
    } else if (dow === 0) {
      // Sunday → observed on following Monday
      const observed = new Date(h.date);
      observed.setDate(observed.getDate() + 1);
      result.push({ name: `${h.name} (Observed)`, date: fmt(observed) });
    }
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}
