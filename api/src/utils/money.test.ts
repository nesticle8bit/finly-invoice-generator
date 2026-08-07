import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { lineAmount, roundMoney, sumLineAmounts } from './money';

describe('roundMoney', () => {
  test('snaps float noise back to cents', () => {
    assert.equal(roundMoney(0.1 + 0.2), 0.3);
    assert.equal(roundMoney(1.005), 1.01, 'a value held as 1.00499… must still round up');
    assert.equal(roundMoney(8.325), 8.33);
  });

  test('non-finite input becomes zero rather than NaN in the DECIMAL column', () => {
    assert.equal(roundMoney(NaN), 0);
    assert.equal(roundMoney(Infinity), 0);
  });
});

describe('sumLineAmounts', () => {
  test('the total equals the sum of the printed line amounts', () => {
    const items = [
      { hours: 1.335, rate: 25 }, // 33.375 → 33.38
      { hours: 2.665, rate: 25 }, // 66.625 → 66.63
    ];

    const printed = items.reduce((sum, i) => sum + lineAmount(i.hours, i.rate), 0);

    assert.equal(sumLineAmounts(items), roundMoney(printed));
    assert.equal(sumLineAmounts(items), 100.01, 'summing raw products would print 100.00');
  });

  test('an empty invoice totals zero', () => {
    assert.equal(sumLineAmounts([]), 0);
  });
});
