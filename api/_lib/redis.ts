// Conexão com o banco (Upstash Redis), usada pelas funções da Vercel.
import { Redis } from '@upstash/redis';
import type { Store } from './house.js';

export function redisStore(): Store | null {
  // A integração Upstash da Vercel cria KV_REST_API_*; uma conta Upstash direta usa UPSTASH_REDIS_REST_*.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    get: (k) => redis.get<string>(k),
    set: async (k, v, ttl) => void (await (ttl ? redis.set(k, v, { ex: ttl }) : redis.set(k, v))),
    setIfAbsent: async (k, v) => (await redis.set(k, v, { nx: true })) === 'OK',
    del: async (k) => void (await redis.del(k)),
  };
}
