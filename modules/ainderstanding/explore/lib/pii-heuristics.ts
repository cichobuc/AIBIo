// BR-XPL-003: name-based only — never content inspection

type PiiResult = {
  isPiiCandidate: boolean;
  reason: string;
};

const EXACT_MATCH = new Set([
  'email',
  'phone',
  'ssn',
  'ip_address',
  'ipaddress',
  'password',
  'passwd',
  'secret',
  'token',
  'api_key',
  'apikey',
]);

const CONTAINS_PATTERNS = [
  'birth',
  'iban',
  'account',
  'card_num',
  'cardnum',
  'credit',
  'address',
  'passport',
  'license',
  'national_id',
  'nationalid',
  'social_security',
  'taxpayer',
  'nino',
  'nin',
];

const PERSON_PREFIXES = new Set(['person', 'user', 'customer', 'client', 'employee', 'member']);

export function detectPii(columnName: string): PiiResult {
  const lower = columnName.toLowerCase();

  if (EXACT_MATCH.has(lower)) {
    return { isPiiCandidate: true, reason: `column name exact match: '${lower}'` };
  }

  for (const pattern of CONTAINS_PATTERNS) {
    if (lower.includes(pattern)) {
      return { isPiiCandidate: true, reason: `column name contains '${pattern}'` };
    }
  }

  if (lower.endsWith('_id')) {
    const prefix = lower.slice(0, lower.length - 3);
    if (PERSON_PREFIXES.has(prefix)) {
      return { isPiiCandidate: true, reason: `column name '${lower}' matches person-id pattern` };
    }
  }

  return { isPiiCandidate: false, reason: '' };
}
