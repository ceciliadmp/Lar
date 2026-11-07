import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handle, memoryStore, readPhoto } from './api/_lib/house.js';

/** Em `npm run dev`, responde /api/lar e /api/photo com dados em memória (somem ao reiniciar). */
function localApi(): Plugin {
  const store = memoryStore();
  return {
    name: 'lar-local-api',
    configureServer(server) {
      server.middlewares.use('/api/photo', async (req, res) => {
        const u = new URL(req.url ?? '', 'http://x').searchParams.get('u') ?? '';
        const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? null;
        const out = await readPhoto(store, token, u);
        if (!out.ok) {
          res.statusCode = out.status;
          res.setHeader('cache-control', 'no-store');
          res.end();
          return;
        }
        res.setHeader('content-type', 'image/jpeg');
        res.setHeader('cache-control', 'no-store');
        res.end(Buffer.from(out.data, 'base64'));
      });
      server.middlewares.use('/api/lar', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          let out;
          try {
            out = await handle(store, JSON.parse(body || '{}'), {
              baseUrl: `http://localhost:${server.config.server.port ?? 5173}`,
              // Em desenvolvimento não manda e-mail: mostra o link no terminal.
              sendEmail: async (email) => console.log(`\n[e-mail para ${email.to}] ${email.subject}\n${email.text}\n`),
            });
          } catch {
            out = { ok: false as const, status: 400, error: 'Pedido inválido.' };
          }
          res.statusCode = out.ok ? 200 : out.status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(out));
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
});
