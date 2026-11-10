import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';

/**
 * Janela sobre a tela. Fecha com Esc ou tocando fora, prende o Tab dentro dela
 * e devolve o foco a quem abriu. O foco começa em `initialFocus` (ou no próprio painel,
 * para não abrir o teclado do celular sozinho).
 */
export function Modal({
  labelledBy,
  describedBy,
  role = 'dialog',
  onClose,
  initialFocus,
  children,
}: {
  labelledBy: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  onClose: () => void;
  initialFocus?: React.RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    (initialFocus?.current ?? panelRef.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = [
          ...panelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea'),
        ];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
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
  }, [onClose, initialFocus]);

  return createPortal(
    <div className="dialog">
      <div className="dialog__scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        className="dialog__panel"
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface DialogAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

/** Janela de confirmação. Abre com o foco em "Cancelar" (a opção segura). */
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
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Modal
      role="alertdialog"
      labelledBy="dialog-title"
      describedBy={children ? 'dialog-text' : undefined}
      onClose={onCancel}
      initialFocus={cancelRef}
    >
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
          <Button key={a.label} variant={a.variant === 'danger' ? 'danger' : (a.variant ?? 'secondary')} onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
        <Button ref={cancelRef} variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </Modal>
  );
}
