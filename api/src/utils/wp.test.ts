import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isValidWP, parseWP, setWP, stripWP } from './wp';

describe('work package helpers', () => {
  test('parses a tagged description', () => {
    assert.equal(parseWP('Fixed the login flow (WP: 3097)'), '3097');
  });

  test('returns null when there is no tag', () => {
    assert.equal(parseWP('Fixed the login flow'), null);
  });

  test('strips the tag without leaving trailing space', () => {
    assert.equal(stripWP('Fixed the login flow (WP: 3097)'), 'Fixed the login flow');
  });

  test('replaces an existing tag instead of appending a second one', () => {
    const updated = setWP('Task (WP: 1)', '2');
    assert.equal(updated, 'Task (WP: 2)');
    assert.equal(parseWP(updated), '2');
  });

  test('removes the tag when the number is cleared', () => {
    assert.equal(setWP('Task (WP: 1)', null), 'Task');
  });

  test('round-trips: whatever passes validation can be read back', () => {
    const written = setWP('Task', '42');
    assert.equal(parseWP(written), '42');
  });

  test('rejects non-numeric values that would silently vanish', () => {
    assert.equal(isValidWP('3097'), true);
    assert.equal(isValidWP('WP-3097'), false);
    assert.equal(isValidWP('abc'), false);
    assert.equal(isValidWP('12.5'), false);
    assert.equal(isValidWP(''), false);

    // Proof of the underlying hazard: a non-numeric tag never parses back.
    assert.equal(parseWP('Task (WP: abc)'), null);
  });
});
