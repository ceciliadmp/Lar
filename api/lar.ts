// Função da Vercel: POST /api/lar
import { Redis } from '@upstash/redis';
import { handle, type Email, type Env, type Store } from './_lib/house.js';

function redisStore(): Store | null {
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

/** Envio pelo Resend (resend.com). Precisa de RESEND_API_KEY; EMAIL_FROM é o remetente. */
function resendSender(): Env['sendEmail'] {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const from = process.env.EMAIL_FROM ?? 'Lar <onboarding@resend.dev>';
  return async (email: Email) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  };
}

/** Endereço público do app: APP_URL, senão o domínio de produção que a Vercel informa. */
function baseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'http://localhost:5173';
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
  const res = await handle(store, body, { baseUrl: baseUrl(), sendEmail: resendSender() });
  return json(res, res.ok ? 200 : res.status);
}
