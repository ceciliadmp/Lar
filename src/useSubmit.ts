import { useState, type FormEvent } from 'react';

/** Estado comum dos formulários: enviando e mensagem de erro. */
export function useSubmit(run: () => Promise<string | null>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await run();
    setBusy(false);
    setError(err);
  };
  return { busy, error, onSubmit };
}
