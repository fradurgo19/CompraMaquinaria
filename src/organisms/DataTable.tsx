import { ReactNode, useState } from 'react';
import { ChevronUp, ChevronDown, FileDown } from 'lucide-react';
import { Button } from '../atoms/Button';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  isLoading?: boolean;
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  onRowClick,
  actions,
  isLoading,
  scrollRef,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey) return 0;

    const aVal = a[sortKey];
    const bVal = b[sortKey];

    if (aVal === bVal) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const comparison = aVal < bVal ? -1 : 1;
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-xl overflow-hidden">
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gradient-to-r from-brand-red to-primary-600 text-white">
            <tr>
              {columns.map((column) => {
                const isSticky = String(column.key) === 'actions' || String(column.key) === 'view';
                const rightPosition = String(column.key) === 'view' ? 'right-[120px]' : 'right-0';
                
                return (
                  <th
                    key={String(column.key)}
                    className={`${isSticky ? `sticky ${rightPosition} bg-brand-red z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)]` : ''} px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{column.label}</span>
                      {column.sortable && (
                        <button
                          onClick={() => handleSort(String(column.key))}
                          className="focus:outline-none"
                        >
                          {sortKey === column.key ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-300" />
                          )}
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              {actions && (
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-8 text-center text-gray-500"
                >
                  No hay datos disponibles
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? 'group hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-200' : 'border-b border-gray-200'}
                >
                  {columns.map((column) => {
                    const isSticky = String(column.key) === 'actions' || String(column.key) === 'view';
                    const rightPosition = String(column.key) === 'view' ? 'right-[120px]' : 'right-0';
                    
                    return (
                      <td 
                        key={String(column.key)} 
                        className={`${isSticky ? `sticky ${rightPosition} bg-white group-hover:bg-red-50 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.1)] transition-colors` : ''} px-6 py-4 whitespace-nowrap text-sm`}
                      >
                        {column.render
                          ? column.render(row)
                          : String(row[column.key] ?? '-')}
                      </td>
                    );
                  })}
                  {actions && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
