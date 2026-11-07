import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, Ref } from 'react';
import type { AvatarInfo } from '../state';

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
      <Icon name="back" size={24} />
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

export function Avatar({ info, size = 'sm' }: { info: AvatarInfo; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span aria-hidden="true" className={`avatar avatar--${size}`} style={{ background: info.bg, color: info.fg }}>
      {info.initial}
    </span>
  );
}

const PATHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="m9.5 14.5 2 2 3.5-4" />
    </>
  ),
  back: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
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

/** Ícones nunca ficam menores que 16×16. */
const MIN_ICON = 16;

export function Icon({ name, size = 24, strokeWidth = 2 }: { name: keyof typeof PATHS; size?: number; strokeWidth?: number }) {
  size = Math.max(size, MIN_ICON);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
