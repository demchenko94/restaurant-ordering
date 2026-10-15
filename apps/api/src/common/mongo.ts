const MONGO_DUPLICATE_KEY = 11000;

/** True for the error MongoDB raises when a unique index rejects a write (E11000). */
export function isDuplicateKey(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === MONGO_DUPLICATE_KEY;
}
