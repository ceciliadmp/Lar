// Função da Vercel: POST /api/lar
import { Redis } from '@upstash/redis';
import { handle, type Store } from './_lib/house.js';

function redisStore(): Store | null {
  // A integração Upstash da Vercel cria KV_REST_API_*; uma conta Upstash direta usa UPSTASH_REDIS_REST_*.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    get: (k) => redis.get<string>(k),
    set: async (k, v) => void (await redis.set(k, v)),
    setIfAbsent: async (k, v) => (await redis.set(k, v, { nx: true })) === 'OK',
    del: async (k) => void (await redis.del(k)),
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export async function POST(request: Request): Promise<Response> {
  const store = redisStore();
  if (!store) {
    return json({ ok: false, error: 'O banco de dados não está configurado na Vercel.' }, 500);
  }
  let body: Parameters<typeof handle>[1];
  try {
    body = (await request.json()) as Parameters<typeof handle>[1];
  } catch {
    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  }
  const res = await handle(store, body);
  return json(res, res.ok ? 200 : res.status);
}
