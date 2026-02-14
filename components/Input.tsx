import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...props }) => {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-400 mb-1.5">
        {label}
      </label>
      <input
        id={inputId}
        className={`
          block w-full rounded-lg bg-slate-900 border-slate-700 shadow-sm 
          text-slate-100 placeholder-slate-500
          focus:border-primary-500 focus:ring-primary-500 focus:ring-1 focus:outline-none
          disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800
          transition duration-150 ease-in-out sm:text-sm px-3 py-2 border
          ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  );
};
