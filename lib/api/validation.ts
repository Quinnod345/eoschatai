import { z } from 'zod/v3';

export const uuidSchema = z.string().uuid('Invalid UUID format');
export const uuidArraySchema = z.array(uuidSchema);

export function isValidUuid(value: string | null | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  return uuidSchema.safeParse(value).success;
}

export function validateUuidField(
  value: string | null | undefined,
  fieldName: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (!value) {
    return { ok: false, error: `${fieldName} is required` };
  }

  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: `Invalid ${fieldName}` };
  }

  return { ok: true, value: parsed.data };
}
