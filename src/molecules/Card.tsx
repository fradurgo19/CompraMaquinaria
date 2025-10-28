import { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export const Card = ({ title, children, actions, className = '' }: CardProps) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          {title && <h3 className="text-lg font-semibold text-gray-800">{title}</h3>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
};
