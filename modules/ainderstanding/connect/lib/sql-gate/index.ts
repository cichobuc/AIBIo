import { regexPrecheck } from './regex-precheck';
import { astValidate, SqlRejectedErr } from './ast-parser';
import type { SqlRejectedError } from '@/core/types/workspace';

export { SqlRejectedErr } from './ast-parser';
export type { SqlRejectedError } from '@/core/types/workspace';

export function validateSelectOnly(sql: string): void {
  const regexResult = regexPrecheck(sql);
  if (!regexResult.passed) {
    throw new SqlRejectedErr({
      code: 'SQL_REJECTED',
      reason: regexResult.reason,
      statement_type: regexResult.keyword,
    });
  }
  astValidate(sql);
}
