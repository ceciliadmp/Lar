// Função da Vercel: GET /api/photo?u=<conta>&v=<versão> devolve a foto de perfil (JPEG).
// Exige o login (Authorization: Bearer <token>) de alguém da mesma casa, ou da própria pessoa.
import { readPhoto } from './_lib/house.js';
import { redisStore } from './_lib/redis.js';

export async function GET(request: Request): Promise<Response> {
  const store = redisStore();
  if (!store) return new Response('Banco de dados não configurado.', { status: 500 });
  const u = new URL(request.url).searchParams.get('u') ?? '';
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const res = await readPhoto(store, token, u);
  if (!res.ok) return new Response(null, { status: res.status, headers: { 'cache-control': 'no-store' } });
  return new Response(Buffer.from(res.data, 'base64'), {
    headers: {
      'content-type': 'image/jpeg',
      // Nada de cache: cada pedido confere de novo se a pessoa ainda é da casa.
      // (O app guarda as fotos na memória enquanto está aberto.)
      'cache-control': 'no-store',
    },
  });
}
