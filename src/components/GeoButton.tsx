import React from 'react';

interface GeoButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
}

export const GeoButton: React.FC<GeoButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  className = '',
  disabled = false,
}) => {
  const baseStyles = 'px-6 py-3 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-[var(--grass-green)] text-white hover:bg-[var(--pine-green)]',
    secondary: 'bg-[var(--accent-aqua)] text-white hover:bg-[var(--pine-green)]',
    outline: 'bg-transparent border-2 border-white text-white hover:bg-white/10',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </button>
  );
};
