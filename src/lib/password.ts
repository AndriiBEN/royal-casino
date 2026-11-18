import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id with the OWASP-recommended baseline (19 MiB memory, 2 iterations, 1 lane).
 * The PHC string returned embeds the salt and parameters, so it can be verified later
 * even if these defaults are raised.
 */
const OPTIONS = {
  algorithm: 2, // Algorithm.Argon2id (ambient const enum, not importable with isolatedModules)
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string) {
  return hash(password, OPTIONS);
}

export async function verifyPassword(stored: string, password: string) {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/**
 * Hash used when the username does not exist, so a failed login takes about
 * the same time either way and does not reveal which usernames are registered.
 */
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string) {
  dummy ??= hashPassword("royal-casino-timing-equaliser");
  await verifyPassword(await dummy, password);
  return false;
}
