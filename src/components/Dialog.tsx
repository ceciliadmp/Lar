import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

export interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

/**
 * Janela de confirmação. Abre com o foco em "Cancelar" (a opção segura),
 * fecha com Esc ou tocando fora, e o Tab fica preso dentro dela.
 */
export function ConfirmDialog({
  title,
  children,
  actions,
  onCancel,
  cancelLabel = 'Cancelar',
}: {
  title: string;
  children?: ReactNode;
  actions: DialogAction[];
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll<HTMLButtonElement>('button')];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.(); // devolve o foco para quem abriu
    };
  }, [onCancel]);

  return createPortal(
    <div className="dialog">
      <div className="dialog__scrim" aria-hidden="true" onClick={onCancel} />
      <div ref={panelRef} className="dialog__panel" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={children ? 'dialog-text' : undefined}>
        <h2 id="dialog-title" className="dialog__title">
          {title}
        </h2>
        {children && (
          <div id="dialog-text" className="dialog__text">
            {children}
          </div>
        )}
        <div className="dialog__actions">
          {actions.map((a) => (
            <Button
              key={a.label}
              variant={a.variant === 'danger' ? 'danger' : (a.variant ?? 'secondary')}
              onClick={a.onClick}
            >
              {a.label}
            </Button>
          ))}
          <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
