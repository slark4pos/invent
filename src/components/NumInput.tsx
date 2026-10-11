import { useEffect, useState } from 'react';

type Props = {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  max?: number;
};

/**
 * Числовое поле, которое не превращает пустой ввод в «0» прямо под пальцами:
 * внутри держим строку, наружу отдаём число.
 */
export default function NumInput({ value, onChange, placeholder, className = 'input', ariaLabel, max }: Props) {
  const [raw, setRaw] = useState(value ? String(value) : '');

  useEffect(() => {
    const parsed = raw.trim() === '' ? 0 : Number(raw.replace(',', '.'));
    if (parsed !== value) setRaw(value ? String(value) : '');
    // Синхронизируем только когда значение поменяли снаружи (кнопки, сброс).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={raw}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,]/g, '');
        setRaw(next);
        const n = next.trim() === '' ? 0 : Number(next.replace(',', '.'));
        if (Number.isFinite(n) && n >= 0) onChange(max != null ? Math.min(n, max) : n);
      }}
    />
  );
}
