import { useEffect, useState } from 'react';
import { loadToken } from './state';

/**
 * Fotos de perfil só saem do servidor para quem está logado na mesma casa,
 * então são baixadas com o login e mostradas a partir da memória do aparelho.
 */
const cache = new Map<string, Promise<string | null>>();

function fetchPhoto(src: string): Promise<string | null> {
  let p = cache.get(src);
  if (!p) {
    p = fetch(src, { headers: { authorization: `Bearer ${loadToken() ?? ''}` } })
      .then(async (res) => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null);
    // Falhou (sem rede, sem permissão): tenta de novo na próxima vez.
    p.then((url) => url ?? cache.delete(src));
    cache.set(src, p);
  }
  return p;
}

/** Endereço local da foto, ou null enquanto carrega / se não puder ver. */
export function usePhoto(src: string | null | undefined): string | null {
  const [state, setState] = useState<{ src: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    void fetchPhoto(src).then((url) => alive && setState({ src, url }));
    return () => {
      alive = false;
    };
  }, [src]);
  return src && state?.src === src ? state.url : null;
}

/** Ao sair da conta: esquece as fotos baixadas. */
export function clearPhotos() {
  for (const p of cache.values()) void p.then((url) => url && URL.revokeObjectURL(url));
  cache.clear();
}
