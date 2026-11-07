import type { ButtonHTMLAttributes, InputHTMLAttributes, Ref } from 'react';
import type { AvatarInfo } from '../state';
import { usePhoto } from '../photos';

type Variant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger-text';

export function Button({
  variant = 'primary',
  size,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  const cls = ['btn', `btn--${variant}`, size && `btn--${size}`, className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}

export function IconButton({ label, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} className={`icon-btn ${className}`} {...rest} />;
}

export function BackButton({ onClick, label = 'Voltar' }: { onClick: () => void; label?: string }) {
  return (
    <IconButton label={label} className="back-btn" onClick={onClick}>
      <Icon name="back" size={18} />
    </IconButton>
  );
}

export function TextField({
  id,
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; ref?: Ref<HTMLInputElement> }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" className={className} {...rest} />
    </div>
  );
}

export function Chip({
  pressed,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} className="chip" {...rest} />
  );
}

export function Avatar({ info, size = 'sm' }: { info: AvatarInfo; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const photo = usePhoto(info.photo);
  return (
    <span aria-hidden="true" className={`avatar avatar--${size}`} style={{ background: info.bg, color: info.fg }}>
      {photo ? <img className="avatar__img" src={photo} alt="" /> : info.initial}
    </span>
  );
}

const PATHS = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="m9.5 14.5 2 2 3.5-4" />
    </>
  ),
  back: <path d="M19 12H5M12 19l-7-7 7-7" />,
  chevron: <path d="M5 12h14M12 5l7 7-7 7" />,
  check: <path d="m4 13 5 5L20 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  repeat: (
    <>
      <path d="m17 2 4 4-4 4" />
      <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" />
      <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
};

/** Onde fica o desenho de cada ícone dentro da grade 24×24: [x0, y0, x1, y1]. */
const BOUNDS: Record<keyof typeof PATHS, [number, number, number, number]> = {
  home: [3, 3, 21, 20],
  back: [5, 5, 19, 19],
  chevron: [5, 5, 19, 19],
  check: [4, 6, 20, 18],
  plus: [5, 5, 19, 19],
  close: [6, 6, 18, 18],
  repeat: [3, 2, 21, 22],
  trophy: [4, 4, 20, 21],
  users: [2.5, 4.5, 21.5, 20],
  trash: [4, 4, 20, 21],
  copy: [5, 3, 20, 20],
};

/** O desenho de um ícone nunca fica menor que 16×16px. */
const MIN_ICON = 16;

/**
 * `size` é o tamanho do desenho em si (lado maior), não da caixa em volta:
 * o ícone é recortado no próprio traço, então 16 quer dizer 16px de forma visível.
 */
export function Icon({ name, size = 20, strokeWidth = 2 }: { name: keyof typeof PATHS; size?: number; strokeWidth?: number }) {
  const [x0, y0, x1, y1] = BOUNDS[name];
  const w = x1 - x0;
  const h = y1 - y0;
  // `size` vale para o lado maior; e nenhum dos dois lados fica abaixo de 16px.
  const scale = Math.max(size / Math.max(w, h), MIN_ICON / Math.min(w, h));
  const pad = strokeWidth / 2;
  return (
    <svg
      width={(w + 2 * pad) * scale}
      height={(h + 2 * pad) * scale}
      viewBox={`${x0 - pad} ${y0 - pad} ${w + 2 * pad} ${h + 2 * pad}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', display: 'block' }}
    >
      {PATHS[name]}
    </svg>
  );
}
