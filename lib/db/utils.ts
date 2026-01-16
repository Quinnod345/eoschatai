import 'server-only';
import { randomBytes } from 'crypto';
import { genSaltSync, hashSync, compareSync } from 'bcrypt-ts';

// AI SDK 5: generateId no longer takes length argument
// Use crypto for generating random passwords
function generateRandomString(length: number): string {
  return randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

export function generateHashedPassword(password: string) {
  try {
    const salt = genSaltSync(10);
    const hash = hashSync(password, salt);
    return hash;
  } catch (error) {
    console.error('Error generating hashed password:', error);
    throw new Error('Failed to hash password');
  }
}

export function verifyPassword(
  plainPassword: string,
  hashedPassword: string,
): boolean {
  try {
    return compareSync(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Error verifying password:', error);
    return false;
  }
}

export function generateDummyPassword() {
  const password = generateRandomString(12);
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}
