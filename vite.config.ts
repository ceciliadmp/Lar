import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handle, memoryStore } from './api/_lib/house.js';

/** Em `npm run dev`, responde /api/lar com dados em memória (somem ao reiniciar). */
function localApi(): Plugin {
  const store = memoryStore();
  return {
    name: 'lar-local-api',
    configureServer(server) {
      server.middlewares.use('/api/lar', (req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', async () => {
          let out;
          try {
            out = await handle(store, JSON.parse(body || '{}'));
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
