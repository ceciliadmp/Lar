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
  filter,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; filter?: boolean }) {
  return (
    <button type="button" aria-pressed={pressed} className={filter ? 'chip chip--filter' : 'chip'} {...rest} />
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
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </>
  ),
};

export function Icon({ name, size = 24, strokeWidth = 2 }: { name: keyof typeof PATHS; size?: number; strokeWidth?: number }) {
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
