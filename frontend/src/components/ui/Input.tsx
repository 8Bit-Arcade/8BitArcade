'use client';

import { forwardRef, InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block font-pixel text-xs text-arcade-green mb-2 uppercase">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-3 font-arcade text-lg
            bg-arcade-black border-2 rounded
            text-white placeholder:text-gray-500
            focus:outline-none transition-all duration-200
            ${
              error
                ? 'border-arcade-red focus:border-arcade-red'
                : 'border-arcade-green/50 focus:border-arcade-green focus:ring-1 focus:ring-arcade-green'
            }
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1 font-arcade text-sm text-arcade-red">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 font-arcade text-sm text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
