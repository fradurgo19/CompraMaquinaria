/**
 * Celda inline para Management con indicadores de historial de cambios.
 * Extraído de ManagementPage para cumplir con SonarQube (evitar definición en parent).
 */
import React from 'react';
import { Clock } from 'lucide-react';

export type ManagementInlineChangeIndicator = {
  id: string;
  fieldName: string;
  fieldLabel: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  reason?: string;
  changedAt: string;
  moduleName?: string | null;
  changedByName?: string | null;
};

export type ManagementInlineCellProps = {
  children: React.ReactNode;
  recordId?: string;
  fieldName?: string;
  indicators?: ManagementInlineChangeIndicator[];
  openPopover?: { recordId: string; fieldName: string } | null;
  onIndicatorClick?: (event: React.MouseEvent, recordId: string, fieldName: string) => void;
  formatChangeValue: (value: string | number | null | undefined, fieldLabel?: string) => string;
  getModuleLabel: (moduleName: string | null | undefined) => string;
};

export const ManagementInlineCell = React.memo<ManagementInlineCellProps>(({
  children,
  recordId,
  fieldName,
  indicators,
  openPopover,
  onIndicatorClick,
  formatChangeValue,
  getModuleLabel,
}) => {
  const hasIndicator = !!(recordId && fieldName && indicators?.length);
  const isOpen =
    hasIndicator && openPopover?.recordId === recordId && openPopover?.fieldName === fieldName;

  const handleStopPropagation = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="relative"
      onClick={handleStopPropagation}
      onMouseDown={handleStopPropagation}
      onKeyDown={handleStopPropagation}
      onKeyUp={handleStopPropagation}
    >
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">{children}</div>
        {hasIndicator && onIndicatorClick && (
          <button
            type="button"
            className="change-indicator-btn inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
            title="Ver historial de cambios"
            onClick={(e) => onIndicatorClick(e, recordId ?? '', fieldName ?? '')}
          >
            <Clock className="w-3 h-3" />
          </button>
        )}
      </div>
      {isOpen && indicators && (
        <div className="change-popover absolute z-30 mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-left">
          <p className="text-xs font-semibold text-gray-500 mb-2">Cambios recientes</p>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {indicators.map((log) => {
              let displayLabel = log.changedByName;
              if (!displayLabel) {
                displayLabel = log.moduleName ? getModuleLabel(log.moduleName) : 'Usuario';
              }
              return (
                <div key={log.id} className="border border-gray-100 rounded-lg p-2 bg-gray-50 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800">{log.fieldLabel}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                      {displayLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Antes:{' '}
                    <span className="font-mono text-red-600">{formatChangeValue(log.oldValue, log.fieldLabel)}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Ahora:{' '}
                    <span className="font-mono text-green-600">{formatChangeValue(log.newValue, log.fieldLabel)}</span>
                  </p>
                  {log.reason && (
                    <p className="text-xs text-gray-600 mt-1 italic">&quot;{log.reason}&quot;</p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-1">
                    {new Date(log.changedAt).toLocaleString('es-CO')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

ManagementInlineCell.displayName = 'ManagementInlineCell';
