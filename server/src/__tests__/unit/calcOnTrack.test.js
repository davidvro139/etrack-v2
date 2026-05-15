const CanvasService = require('../../services/CanvasService');

// Use a real instance — calcOnTrack doesn't make any API calls
const cs = new CanvasService('http://fake.canvas.edu', 'fake-token', '');

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

describe('CanvasService.calcOnTrack', () => {
  test('returns Unknown when totalModules is 0', () => {
    const result = cs.calcOnTrack(0, 0, daysFromNow(30), daysAgo(10));
    expect(result.state).toBe('Unknown');
    expect(result.label).toBe('No modules');
    expect(result.progressPercent).toBe(0);
  });

  test('returns Unknown when no dueDate', () => {
    const result = cs.calcOnTrack(5, 10, null, daysAgo(10));
    expect(result.state).toBe('Unknown');
    expect(result.progressPercent).toBe(50);
  });

  test('returns OnTrack when progress matches expected', () => {
    // 50% through time, 50% through modules
    const result = cs.calcOnTrack(5, 10, daysFromNow(30), daysAgo(30));
    expect(result.state).toBe('OnTrack');
    expect(result.progressPercent).toBe(50);
  });

  test('returns SlightlyBehind when just under expected', () => {
    // 60% through time, 45% through modules (within 15% gap)
    const result = cs.calcOnTrack(5, 10, daysFromNow(20), daysAgo(30));
    expect(['SlightlyBehind', 'Behind']).toContain(result.state);
  });

  test('returns Overdue when past deadline with incomplete modules', () => {
    const result = cs.calcOnTrack(5, 10, daysAgo(5), daysAgo(30));
    expect(result.state).toBe('Overdue');
    expect(result.label).toBe('Overdue');
    expect(result.expectedPercent).toBe(100);
  });

  test('returns OnTrack when 100% complete regardless of deadline', () => {
    const result = cs.calcOnTrack(10, 10, daysFromNow(10), daysAgo(30));
    expect(result.state).toBe('OnTrack');
    expect(result.progressPercent).toBe(100);
  });

  test('progressPercent is calculated correctly', () => {
    const result = cs.calcOnTrack(3, 12, daysFromNow(30), daysAgo(10));
    expect(result.progressPercent).toBe(25);
  });
});
