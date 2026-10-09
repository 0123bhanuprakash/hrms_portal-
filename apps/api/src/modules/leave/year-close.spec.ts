import { describe, expect, it } from 'vitest';
import { closeYear, takeBack } from './leave-rules';

const base = { carryForward: false, maxCarry: 0, lendLimit: 0, recoverNegative: true, owedLeft: 0 };

describe('closeYear', () => {
  it('unused days lapse when the type does not carry', () => expect(closeYear({ ...base, left: 3 })).toEqual({ carriedOut: 0, lapsed: 3, owedOut: 0 }));
  it('carries up to the cap, the rest lapses', () => expect(closeYear({ ...base, left: 12, carryForward: true, maxCarry: 10 })).toEqual({ carriedOut: 10, lapsed: 2, owedOut: 0 }));
  it('a minus balance is owed to next year', () => expect(closeYear({ ...base, left: -2 })).toEqual({ carriedOut: 0, lapsed: 0, owedOut: 2 }));
  it('when the type forgives minus balances, only lent days are owed', () => {
    expect(closeYear({ ...base, left: -5, recoverNegative: false, lendLimit: 3 }).owedOut).toBe(3);
    expect(closeYear({ ...base, left: -2, recoverNegative: false }).owedOut).toBe(0);
  });
  it('owed days not yet taken back roll on', () => {
    expect(closeYear({ ...base, left: 4, owedLeft: 2 }).owedOut).toBe(2);
    expect(closeYear({ ...base, left: -1, owedLeft: 2 }).owedOut).toBe(3);
  });
});

describe('takeBack', () => {
  it('takes all when there is room', () => expect(takeBack(3, 12)).toEqual({ taken: 3, stillOwed: 0 }));
  it('never below 0: the rest stays owed', () => expect(takeBack(10, 6)).toEqual({ taken: 6, stillOwed: 4 }));
  it('nothing to take from', () => expect(takeBack(2, -1)).toEqual({ taken: 0, stillOwed: 2 }));
});
