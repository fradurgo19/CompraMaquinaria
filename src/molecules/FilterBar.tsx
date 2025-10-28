import { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
}

export const FilterBar = ({ children }: FilterBarProps) => {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
};
