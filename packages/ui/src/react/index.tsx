import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'light'; compact?: boolean };
export function Button({ variant = 'primary', compact = false, className = '', children, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`button button--${variant} ${compact ? 'button--compact' : ''} ${className}`} {...props}><span>{children}</span></button>;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; compact?: boolean };
export function TextField({ id, label, compact = false, className = '', ...props }: InputProps) {
  return <><label htmlFor={id} className="field-label">{label}</label><input id={id} className={`field-input ${compact ? 'field-input--compact' : ''} ${className}`} {...props} /></>;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { id: string; label: string };
export function SelectField({ id, label, className = '', ...props }: SelectProps) {
  return <><label htmlFor={id} className="field-label">{label}</label><select id={id} className={`field-select ${className}`} {...props} /></>;
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string; label: string };
export function TextArea({ id, label, className = '', ...props }: TextareaProps) {
  return <><label htmlFor={id} className="field-label">{label}</label><textarea id={id} className={`field-textarea ${className}`} {...props} /></>;
}

export function Brand() {
  return <a href="/" aria-label="沖縄介護センター ホーム" className="brand">
    <span><strong>沖縄介護センター</strong><small>あなたの「想い」を支えます</small></span>
  </a>;
}
