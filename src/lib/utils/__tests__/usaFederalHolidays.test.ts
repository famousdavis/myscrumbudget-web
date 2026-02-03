import { describe, it, expect } from 'vitest';
import { getUSAFederalHolidays } from '../usaFederalHolidays';

describe('getUSAFederalHolidays', () => {
  describe('2026', () => {
    const holidays = getUSAFederalHolidays(2026);
    const byName = (name: string) => holidays.filter((h) => h.name === name);
    const find = (name: string) => holidays.find((h) => h.name === name);

    it('returns 11 base holidays', () => {
      const baseNames = holidays.filter((h) => !h.name.includes('(Observed)'));
      expect(baseNames).toHaveLength(11);
    });

    it("has New Year's Day on Jan 1 (Thursday)", () => {
      expect(find("New Year's Day")?.date).toBe('2026-01-01');
      // Thursday — no observed date
      expect(byName("New Year's Day (Observed)")).toHaveLength(0);
    });

    it('has MLK Day on 3rd Monday of January', () => {
      expect(find('Martin Luther King Jr. Day')?.date).toBe('2026-01-19');
    });

    it("has Presidents' Day on 3rd Monday of February", () => {
      expect(find("Presidents' Day")?.date).toBe('2026-02-16');
    });

    it('has Memorial Day on last Monday of May', () => {
      expect(find('Memorial Day')?.date).toBe('2026-05-25');
    });

    it('has Juneteenth on Jun 19 (Friday)', () => {
      expect(find('Juneteenth')?.date).toBe('2026-06-19');
      // Friday — no observed date
      expect(byName('Juneteenth (Observed)')).toHaveLength(0);
    });

    it('has Independence Day on Jul 4 (Saturday) with observed on Jul 3', () => {
      expect(find('Independence Day')?.date).toBe('2026-07-04');
      expect(find('Independence Day (Observed)')?.date).toBe('2026-07-03');
    });

    it('has Labor Day on 1st Monday of September', () => {
      expect(find('Labor Day')?.date).toBe('2026-09-07');
    });

    it('has Columbus Day on 2nd Monday of October', () => {
      expect(find('Columbus Day')?.date).toBe('2026-10-12');
    });

    it('has Veterans Day on Nov 11 (Wednesday)', () => {
      expect(find('Veterans Day')?.date).toBe('2026-11-11');
      expect(byName('Veterans Day (Observed)')).toHaveLength(0);
    });

    it('has Thanksgiving on 4th Thursday of November', () => {
      expect(find('Thanksgiving Day')?.date).toBe('2026-11-26');
    });

    it('has Christmas Day on Dec 25 (Friday)', () => {
      expect(find('Christmas Day')?.date).toBe('2026-12-25');
      expect(byName('Christmas Day (Observed)')).toHaveLength(0);
    });

    it('is sorted by date', () => {
      const dates = holidays.map((h) => h.date);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    });
  });

  describe('2027 — Sunday observed dates', () => {
    const holidays = getUSAFederalHolidays(2027);
    const find = (name: string) => holidays.find((h) => h.name === name);

    it('has Independence Day on Jul 4 (Sunday) with observed on Jul 5 (Monday)', () => {
      expect(find('Independence Day')?.date).toBe('2027-07-04');
      expect(find('Independence Day (Observed)')?.date).toBe('2027-07-05');
    });

    it('has Christmas on Dec 25 (Saturday) with observed on Dec 24 (Friday)', () => {
      expect(find('Christmas Day')?.date).toBe('2027-12-25');
      expect(find('Christmas Day (Observed)')?.date).toBe('2027-12-24');
    });
  });

  describe('2028', () => {
    const holidays = getUSAFederalHolidays(2028);
    const find = (name: string) => holidays.find((h) => h.name === name);

    it("has New Year's Day on Jan 1 (Saturday) with observed on Dec 31 2027", () => {
      expect(find("New Year's Day")?.date).toBe('2028-01-01');
      expect(find("New Year's Day (Observed)")?.date).toBe('2027-12-31');
    });

    it('has Juneteenth on Jun 19 (Monday)', () => {
      expect(find('Juneteenth')?.date).toBe('2028-06-19');
    });

    it('has Independence Day on Jul 4 (Tuesday)', () => {
      expect(find('Independence Day')?.date).toBe('2028-07-04');
    });

    it('has Christmas on Dec 25 (Monday)', () => {
      expect(find('Christmas Day')?.date).toBe('2028-12-25');
    });

    it('has Thanksgiving on 4th Thursday of November (Nov 23)', () => {
      expect(find('Thanksgiving Day')?.date).toBe('2028-11-23');
    });
  });

  it('includes all 11 federal holiday names for any year', () => {
    const expectedNames = [
      "New Year's Day",
      'Martin Luther King Jr. Day',
      "Presidents' Day",
      'Memorial Day',
      'Juneteenth',
      'Independence Day',
      'Labor Day',
      'Columbus Day',
      'Veterans Day',
      'Thanksgiving Day',
      'Christmas Day',
    ];

    for (const year of [2026, 2027, 2028]) {
      const holidays = getUSAFederalHolidays(year);
      const baseNames = holidays
        .filter((h) => !h.name.includes('(Observed)'))
        .map((h) => h.name);
      for (const name of expectedNames) {
        expect(baseNames).toContain(name);
      }
    }
  });
});
