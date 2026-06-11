import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

import { cx } from "../cx";

const controlClasses =
  "block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-2 focus:outline-brand-500/40 aria-[invalid=true]:border-red-500";

interface FieldChrome {
  id: string;
  label: string;
  /** Helper text shown under the control. */
  hint?: string;
  /** Validation message — announced to screen readers via role="alert". */
  error?: string;
}

function describedBy({ id, hint, error }: FieldChrome): string | undefined {
  const ids = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldShell({ field, children }: { field: FieldChrome; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={field.id} className="block text-sm font-semibold text-brand-900">
        {field.label}
      </label>
      {children}
      {field.hint && (
        <p id={`${field.id}-hint`} className="text-sm text-slate-500">
          {field.hint}
        </p>
      )}
      {field.error && (
        <p id={`${field.id}-error`} role="alert" className="text-sm font-medium text-red-600">
          {field.error}
        </p>
      )}
    </div>
  );
}

export type TextFieldProps = FieldChrome &
  Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "aria-describedby" | "aria-invalid">;

export function TextField({ id, label, hint, error, className, ...rest }: TextFieldProps) {
  const field = { id, label, hint, error };
  return (
    <FieldShell field={field}>
      <input
        id={id}
        aria-describedby={describedBy(field)}
        aria-invalid={error ? true : undefined}
        className={cx(controlClasses, className)}
        {...rest}
      />
    </FieldShell>
  );
}

export type TextAreaFieldProps = FieldChrome &
  Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "aria-describedby" | "aria-invalid">;

export function TextAreaField({ id, label, hint, error, className, ...rest }: TextAreaFieldProps) {
  const field = { id, label, hint, error };
  return (
    <FieldShell field={field}>
      <textarea
        id={id}
        rows={4}
        aria-describedby={describedBy(field)}
        aria-invalid={error ? true : undefined}
        className={cx(controlClasses, "min-h-24", className)}
        {...rest}
      />
    </FieldShell>
  );
}

export type SelectFieldProps = FieldChrome &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "aria-describedby" | "aria-invalid"> & {
    children: ReactNode;
  };

export function SelectField({ id, label, hint, error, className, children, ...rest }: SelectFieldProps) {
  const field = { id, label, hint, error };
  return (
    <FieldShell field={field}>
      <select
        id={id}
        aria-describedby={describedBy(field)}
        aria-invalid={error ? true : undefined}
        className={cx(controlClasses, className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}
