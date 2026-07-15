import { dueMilestones } from './subscription-reminder.service';

const H = 3_600_000;

describe('dueMilestones', () => {
  const keys = (ms: number) => dueMilestones(ms).map((m) => m.key);

  it('returns nothing for already-expired or 0 remaining', () => {
    expect(keys(0)).toEqual([]);
    expect(keys(-5 * H)).toEqual([]);
  });

  it('only 7d when between 3 and 7 days out', () => {
    expect(keys(5 * 24 * H)).toEqual(['7d']);
  });

  it('7d + 3d when between 1 and 3 days out', () => {
    expect(keys(2 * 24 * H)).toEqual(['7d', '3d']);
  });

  it('all three within the final 24 hours', () => {
    expect(keys(12 * H)).toEqual(['7d', '3d', '24h']);
  });

  it('nothing when further than 7 days out', () => {
    expect(keys(10 * 24 * H)).toEqual([]);
  });
});
