import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback cache when Upstash Redis credentials are not set
class InMemoryRedis {
  private store = new Map<string, any>();
  private sets = new Map<string, Set<string>>();
  private lists = new Map<string, string[]>();

  async get<T = any>(key: string): Promise<T | null> {
    const val = this.store.get(key);
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<"OK"> {
    this.store.set(key, value);
    if (options?.ex) {
      setTimeout(() => this.store.delete(key), options.ex * 1000);
    }
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
      if (this.sets.delete(key)) count++;
      if (this.lists.delete(key)) count++;
    }
    return count;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async rpush(key: string, ...elements: string[]): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    const list = this.lists.get(key)!;
    list.push(...elements);
    return list.length;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key);
    if (!list) return [];
    if (stop === -1) return list.slice(start);
    return list.slice(start, stop + 1);
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    const list = this.lists.get(key);
    if (!list) return 0;
    const initialLen = list.length;
    const filtered = list.filter((v) => v !== value);
    this.lists.set(key, filtered);
    return initialLen - filtered.length;
  }
}

export const redis =
  redisUrl && redisToken && redisUrl !== "placeholder"
    ? new Redis({ url: redisUrl, token: redisToken })
    : (new InMemoryRedis() as unknown as Redis);

export default redis;
