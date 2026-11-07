import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, IconButton } from './ui';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

const MENU_WIDTH = 168;
const GAP = 4;

/**
 * Botão ⋮ que abre um menu de opções.
 * Teclado: setas sobem/descem, Enter escolhe, Esc fecha e devolve o foco ao botão.
 * Fecha ao tocar fora ou rolar a lista.
 */
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setPos(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Posição: abaixo do botão, alinhado à direita; se não couber, abre para cima.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const h = menuRef.current.offsetHeight;
    const below = r.bottom + GAP + h <= window.innerHeight - 8;
    setPos({
      top: below ? r.bottom + GAP : r.top - GAP - h,
      left: Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    });
    menuRef.current.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !triggerRef.current?.contains(t)) close(false);
    };
    const onScroll = () => close(false);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]') ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  return (
    <>
      <IconButton
        ref={triggerRef}
        label={label}
        className="row-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <Icon name="more" size={18} />
      </IconButton>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="row-menu"
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{ width: MENU_WIDTH, top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                className={it.danger ? 'row-menu__item row-menu__item--danger' : 'row-menu__item'}
                onClick={() => {
                  close(false);
                  it.onSelect();
                }}
              >
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
