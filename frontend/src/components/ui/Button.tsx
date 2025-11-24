'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'font-pixel uppercase tracking-wider transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    const variants = {
      primary:
        'bg-arcade-green border-2 border-arcade-green text-arcade-black hover:bg-arcade-cyan hover:border-arcade-cyan',
      secondary:
        'bg-transparent border-2 border-arcade-green text-arcade-green hover:bg-arcade-green hover:text-arcade-black',
      danger:
        'bg-transparent border-2 border-arcade-red text-arcade-red hover:bg-arcade-red hover:text-arcade-black',
      ghost:
        'bg-transparent border-2 border-transparent text-arcade-green hover:border-arcade-green/50',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-6 py-3 text-sm',
      lg: 'px-8 py-4 text-base',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="loader w-4 h-4 border-2" />
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
