'use client';

import { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export default function Select({ 
  value, 
  onChange, 
  options, 
  className = 'w-full', 
  placeholder = 'Chọn', 
  disabled = false,
  size = 'sm'
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder;

  const sizeClasses = {
    xs: 'pl-2 pr-6 py-1 text-xs',
    sm: 'pl-3 pr-10 py-2 text-sm',
    md: 'pl-4 pr-10 py-2.5 text-base'
  };

  const optionSizeClasses = {
    xs: 'px-2 py-1.5 text-xs',
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base'
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full ${sizeClasses[size]} border border-gray-200 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span className="truncate">{selectedLabel}</span>
      </button>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 p-1 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(String(option.value));
                setIsOpen(false);
              }}
              className={`w-full text-left rounded-md transition-colors ${optionSizeClasses[size]} ${
                String(value) === String(option.value)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
