// Função da Vercel: GET /api/photo?u=<conta>&v=<versão> devolve a foto de perfil (JPEG).
import { photoKey } from './_lib/house.js';
import { redisStore } from './_lib/redis.js';

export async function GET(request: Request): Promise<Response> {
  const u = new URL(request.url).searchParams.get('u') ?? '';
  const store = redisStore();
  const data = store && /^[0-9a-f]{32}$/.test(u) ? await store.get(photoKey(u)) : null;
  if (!data) return new Response('Foto não encontrada.', { status: 404 });
  return new Response(Buffer.from(data, 'base64'), {
    headers: {
      'content-type': 'image/jpeg',
      // O endereço muda quando a foto muda (?v=…), então pode ficar em cache por muito tempo.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
