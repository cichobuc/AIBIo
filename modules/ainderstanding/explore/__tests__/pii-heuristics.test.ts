import { describe, it, expect } from 'vitest';
import { detectPii } from '../lib/pii-heuristics';

describe('detectPii', () => {
  it('detects exact matches', () => {
    expect(detectPii('email').isPiiCandidate).toBe(true);
    expect(detectPii('phone').isPiiCandidate).toBe(true);
    expect(detectPii('ssn').isPiiCandidate).toBe(true);
    expect(detectPii('password').isPiiCandidate).toBe(true);
    expect(detectPii('token').isPiiCandidate).toBe(true);
  });

  it('detects contains patterns', () => {
    expect(detectPii('user_email_address').isPiiCandidate).toBe(true);
    expect(detectPii('birth_date').isPiiCandidate).toBe(true);
    expect(detectPii('iban_number').isPiiCandidate).toBe(true);
    expect(detectPii('credit_card').isPiiCandidate).toBe(true);
    expect(detectPii('passport_no').isPiiCandidate).toBe(true);
  });

  it('detects _id suffix with person prefix', () => {
    expect(detectPii('user_id').isPiiCandidate).toBe(true);
    expect(detectPii('person_id').isPiiCandidate).toBe(true);
    expect(detectPii('customer_id').isPiiCandidate).toBe(true);
  });

  it('does not flag generic _id columns', () => {
    expect(detectPii('product_id').isPiiCandidate).toBe(false);
    expect(detectPii('order_id').isPiiCandidate).toBe(false);
  });

  it('does not flag innocent columns', () => {
    expect(detectPii('name').isPiiCandidate).toBe(false);
    expect(detectPii('price').isPiiCandidate).toBe(false);
    expect(detectPii('quantity').isPiiCandidate).toBe(false);
    expect(detectPii('created_at').isPiiCandidate).toBe(false);
  });

  it('returns reason when PII detected', () => {
    const result = detectPii('email');
    expect(result.reason).toBeTruthy();
    expect(result.reason.length).toBeGreaterThan(0);
  });
});
