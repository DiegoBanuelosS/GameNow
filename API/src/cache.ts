type Entry<T> = {
  value: T;
  expires: number;
};

const memory = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string) {
  const hit = memory.get(key) as Entry<T> | undefined;
  if (!hit) {
    return undefined;
  }
  if (hit.expires < Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return hit.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  memory.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
