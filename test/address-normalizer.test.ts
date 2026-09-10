import assert from 'node:assert/strict';
import test from 'node:test';
import { AddressNormalizer } from '../src/domain/address-normalizer.ts';

test('normalizes empty and non-string addresses', () => {
  assert.deepEqual(AddressNormalizer.normalize(''), { line1: '', line2: '' });
  assert.deepEqual(AddressNormalizer.normalize('   '), { line1: '', line2: '' });
  assert.deepEqual(AddressNormalizer.normalize(null), { line1: '', line2: '' });
  assert.deepEqual(AddressNormalizer.normalize(123), { line1: '', line2: '' });
});

test('normalizes whitespace, half addresses, and street abbreviations', () => {
  assert.deepEqual(AddressNormalizer.normalize('  12  Main St.  Apt2  '), {
    line1: '12 Main Street',
    line2: 'Apt 2',
  });
  assert.deepEqual(AddressNormalizer.normalize('12 Main St Apt 2'), {
    line1: '12 Main Street',
    line2: 'Apt 2',
  });
  assert.deepEqual(AddressNormalizer.normalize('45 1/2 Ave. Rd. Dr. Blvd.'), {
    line1: '45 ½ Avenue Road Drive Boulevard',
    line2: '',
  });
});

test('splits line-based addresses', () => {
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street\nSuite 4'), {
    line1: '12 Main Street',
    line2: 'Suite 4',
  });
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street\n\nUnit 4\nCity'), {
    line1: '12 Main Street',
    line2: 'Unit 4',
  });
});

test('parses numeric dash-separated units', () => {
  assert.deepEqual(AddressNormalizer.normalize('4-123 Main Street'), {
    line1: '123 Main Street',
    line2: 'Unit 4',
  });
  assert.deepEqual(AddressNormalizer.normalize('Unit 4 - 123 Main Street'), {
    line1: '123 Main Street',
    line2: 'Unit 4',
  });
  assert.deepEqual(AddressNormalizer.normalize('Apt 4-123 Main Street'), {
    line1: '123 Main Street',
    line2: 'Unit 4',
  });
});

test('parses civic number suffixes', () => {
  assert.deepEqual(AddressNormalizer.normalize('12-A Main Street'), {
    line1: '12A Main Street',
    line2: '',
  });
  assert.deepEqual(AddressNormalizer.normalize('A-12 Main Street'), {
    line1: '12A Main Street',
    line2: '',
  });
  assert.deepEqual(AddressNormalizer.normalize('12 1/2 Main Street'), {
    line1: '12 ½ Main Street',
    line2: '',
  });
});

test('parses spaced dash units and inline units', () => {
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street - Apt 4'), {
    line1: '12 Main Street',
    line2: 'Apt 4',
  });
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street - 4'), {
    line1: '12 Main Street',
    line2: 'Unit 4',
  });
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street, Apartment 4'), {
    line1: '12 Main Street',
    line2: 'Apartment 4',
  });
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street Unit 4'), {
    line1: '12 Main Street',
    line2: 'Unit 4',
  });
});

test('leaves ordinary street addresses on line one', () => {
  assert.deepEqual(AddressNormalizer.normalize('12 Main Street'), {
    line1: '12 Main Street',
    line2: '',
  });
});
