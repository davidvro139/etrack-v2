import { importAgeLabel, importIsOverdue } from '@/hooks/useLastImport';

describe('importAgeLabel', () => {
  test('returns "Never imported" for null', () => {
    expect(importAgeLabel(null)).toBe('Never imported');
  });

  test('returns "Today" for a timestamp from earlier today', () => {
    const earlier = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
    expect(importAgeLabel(earlier)).toBe('Today');
  });

  test('returns "1 day ago" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000 * 1.5).toISOString();
    expect(importAgeLabel(yesterday)).toBe('1 day ago');
  });

  test('returns "N days ago" for older dates', () => {
    const fiveDaysAgo = new Date(Date.now() - 86400000 * 5.5).toISOString();
    expect(importAgeLabel(fiveDaysAgo)).toBe('5 days ago');
  });
});

describe('importIsOverdue', () => {
  test('returns true for null (never imported)', () => {
    expect(importIsOverdue(null)).toBe(true);
  });

  test('returns false for a recent import (2 days ago)', () => {
    const recent = new Date(Date.now() - 86400000 * 2).toISOString();
    expect(importIsOverdue(recent)).toBe(false);
  });

  test('returns true for an import over 7 days ago', () => {
    const old = new Date(Date.now() - 86400000 * 8).toISOString();
    expect(importIsOverdue(old)).toBe(true);
  });

  test('returns false for exactly 7 days ago (boundary)', () => {
    const boundary = new Date(Date.now() - 86400000 * 7 + 1000).toISOString();
    expect(importIsOverdue(boundary)).toBe(false);
  });
});
