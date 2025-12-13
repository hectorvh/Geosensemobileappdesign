import React from 'react';

interface GeoInputProps {
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  required?: boolean;
}

export const GeoInput: React.FC<GeoInputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  className = '',
  required = false,
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      required={required}
      className={`w-full px-4 py-3 bg-white/90 backdrop-blur-sm rounded-lg border border-white/30 text-[var(--deep-forest)] placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--grass-green)] ${className}`}
    />
  );
};
