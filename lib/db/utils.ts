import 'server-only';
import { generateId } from 'ai';
import { genSaltSync, hashSync, compareSync } from 'bcrypt-ts';

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
  const password = generateId(12);
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}
