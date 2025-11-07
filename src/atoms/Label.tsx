import { LabelHTMLAttributes, ReactNode } from 'react';

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
}

export const Label = ({ children, required, className = '', ...props }: LabelProps) => {
  return (
    <label className={`block text-sm font-medium text-brand-gray ${className}`} {...props}>
      {children}
      {required && <span className="text-brand-red ml-1">*</span>}
    </label>
  );
};
