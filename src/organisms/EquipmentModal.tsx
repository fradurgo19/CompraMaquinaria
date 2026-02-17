/**
 * Modal para Agregar/Editar Equipos
 * Diseño elegante y empresarial
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { MachineFiles } from '../components/MachineFiles';
import { MachineFilesDragDrop } from '../components/MachineFilesDragDrop';
import { apiPost, apiPut, apiGet } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { ChangeLogModal } from '../components/ChangeLogModal';
import { useChangeDetection } from '../hooks/useChangeDetection';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment?: EquipmentModalRecord | null;
  onSuccess: () => void;
}

type EquipmentModalRecord = {
  id: string;
  machine_id?: string | null;
  full_serial?: string | number | null;
  state?: string | null;
  machine_type?: string | null;
  wet_line?: string | null;
  arm_type?: string | null;
  track_width?: string | number | null;
  bucket_capacity?: string | number | null;
  engine_brand?: string | null;
  cabin_type?: string | null;
  commercial_observations?: string | null;
  model?: string | null;
  serial?: string | null;
};

type EquipmentModalFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: 'FOTO' | 'DOCUMENTO';
  scope?: string;
};

// Estados alineados con la vista de tabla de Equipments
// Eliminados: Lista, Pendiente Entrega, Vendida. Agregado: Entregada. Incluye Pre-Reserva.
const STATES = ['Libre', 'Pre-Reserva', 'Reservada', 'Separada', 'Entregada'];

export const EquipmentModal = ({ isOpen, onClose, equipment, onSuccess }: EquipmentModalProps) => {
  const { userProfile } = useAuth();
  const isCommercialUser = userProfile?.role === 'comerciales';
  const isJefeComercial = userProfile?.role === 'jefe_comercial';
  const [formData, setFormData] = useState({
    full_serial: '',
    state: 'Libre',
    machine_type: '',
    wet_line: 'No',
    arm_type: 'N/A',
    track_width: '',
    bucket_capacity: '',
    engine_brand: 'N/A',
    cabin_type: 'N/A',
    commercial_observations: '',
  });
  const [loading, setLoading] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<Record<string, unknown> | null>(null);
  const [allPhotos, setAllPhotos] = useState<EquipmentModalFile[]>([]);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);
  const [commercialMaterialExpanded, setCommercialMaterialExpanded] = useState(true);

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    state: 'Estado',
    machine_type: 'Tipo de Máquina',
    wet_line: 'Línea Húmeda',
    arm_type: 'Tipo de Brazo',
    track_width: 'Ancho Zapatas',
    bucket_capacity: 'Capacidad Cucharón',
    engine_brand: 'Marca Motor',
    cabin_type: 'Tipo Cabina',
    commercial_observations: 'Observaciones Comerciales',
  };

  // Hook de detección de cambios
  const { hasChanges, changes } = useChangeDetection(
    equipment, 
    formData, 
    MONITORED_FIELDS
  );

  useEffect(() => {
    if (equipment) {
      setFormData({
        full_serial: equipment.full_serial !== null && equipment.full_serial !== undefined ? String(equipment.full_serial) : '',
        state: equipment.state || 'Libre',
        machine_type: equipment.machine_type || '',
        // Usar valores por defecto si el campo es null/undefined
        // El hook useChangeDetection ahora trata estos valores como equivalentes a null
        wet_line: equipment.wet_line || 'No',
        arm_type: equipment.arm_type || 'N/A',
        track_width: equipment.track_width !== null && equipment.track_width !== undefined ? String(equipment.track_width) : '',
        bucket_capacity: equipment.bucket_capacity !== null && equipment.bucket_capacity !== undefined ? String(equipment.bucket_capacity) : '',
        engine_brand: equipment.engine_brand || 'N/A',
        cabin_type: equipment.cabin_type || 'N/A',
        commercial_observations: equipment.commercial_observations || '',
      });
      
      // Cargar archivos de todos los módulos para drag & drop
      if (equipment.machine_id && isJefeComercial) {
        loadAllFiles(equipment.machine_id);
      }
    } else {
      setFormData({
        full_serial: '',
        state: 'Libre',
        machine_type: '',
        wet_line: 'No',
        arm_type: 'N/A',
        track_width: '',
        bucket_capacity: '',
        engine_brand: 'N/A',
        cabin_type: 'N/A',
        commercial_observations: '',
      });
    }
  }, [equipment, isJefeComercial]);

  const loadAllFiles = async (machineId: string) => {
    try {
      const files = await apiGet<EquipmentModalFile[]>(`/api/files/${machineId}`);
      setAllPhotos(files.filter(f => f.file_type === 'FOTO'));
    } catch (error) {
      console.error('Error cargando archivos:', error);
    }
  };

  const handleFilesMoved = () => {
    if (equipment?.machine_id) {
      loadAllFiles(equipment.machine_id);
    }
    setFilesRefreshKey(prev => prev + 1);
  };

  const getFilePreviewUrl = (fileId: string): string => {
    const baseApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${baseApiUrl}/api/files/download/${encodeURIComponent(fileId)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Si no hay cambios reales, no hacer nada (evitar guardados innecesarios)
    if (equipment && (!hasChanges || changes.length === 0)) {
      console.log('⚠️ No hay cambios para guardar, cancelando submit');
      return;
    }

    let data: Record<string, unknown> = {};
    
    // Si es usuario comercial normal, solo puede editar el estado
    if (userProfile?.role === 'comerciales') {
      data = { state: formData.state };
    } else {
      // Jefe comercial puede editar todos los campos
      data = {
        ...formData,
        full_serial: formData.full_serial ? Number(formData.full_serial) : null,
        track_width: formData.track_width ? Number(formData.track_width) : null,
        bucket_capacity: formData.bucket_capacity ? Number(formData.bucket_capacity) : null,
      };
    }

    // Si es edición y hay cambios, mostrar modal de control de cambios
    if (equipment && hasChanges && changes.length > 0) {
      setPendingUpdate(data);
      setShowChangeModal(true);
      return;
    }

    // Si no hay cambios o es creación nueva, continuar normal
    await saveChanges();
  };

  const saveChanges = async (changeReason?: string) => {
    setLoading(true);
    try {
      const data = pendingUpdate || {
        ...formData,
        full_serial: formData.full_serial ? Number(formData.full_serial) : null,
        track_width: formData.track_width ? Number(formData.track_width) : null,
        bucket_capacity: formData.bucket_capacity ? Number(formData.bucket_capacity) : null,
      };

      console.log('💾 Guardando cambios en Equipments...');
      console.log('  - ID:', equipment?.id);
      console.log('  - Data:', data);
      console.log('  - hasChanges:', hasChanges);
      console.log('  - changes:', changes);

      if (equipment) {
        await apiPut(`/api/equipments/${equipment.id}`, data);

        // Registrar cambios en el log si hay
        if (hasChanges && changes.length > 0) {
          console.log('📝 Intentando registrar cambios en change_logs...');
          try {
            const logPayload = {
              table_name: 'equipments',
              record_id: equipment.id,
              changes: changes,
              change_reason: changeReason || null
            };
            console.log('  - Payload:', logPayload);
            
            const result = await apiPost('/api/change-logs', logPayload);
            console.log(`✅ ${changes.length} cambios registrados en Equipos`, result);
          } catch (logError) {
            console.error('❌ Error registrando cambios:', logError);
          }
        } else {
          console.log('⚠️ No hay cambios para registrar (hasChanges:', hasChanges, 'changes.length:', changes.length, ')');
        }

        showSuccess('Equipo actualizado exitosamente');
      } else {
        showError('Función de creación pendiente');
      }
      
      setShowChangeModal(false);
      setPendingUpdate(null);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error al guardar equipo:', error);
      showError('Error al guardar el equipo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <AnimatePresence>
      {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {equipment ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h2>
              {equipment && (
                <p className="text-white/90 text-sm mt-1">
                  {equipment.model || '-'} | Serie: {equipment.serial || '-'}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Content */}
          <form
            onSubmit={handleSubmit}
            className="p-4 overflow-y-auto max-h-[calc(85vh-100px)]"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Estado */}
              <div>
                <label htmlFor="equipment-modal-state" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Estado *
                </label>
                <select
                  id="equipment-modal-state"
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                >
                  {STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              {/* Observaciones Comerciales */}
              <div className="md:col-span-2">
                <label htmlFor="equipment-modal-commercial-observations" className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Observaciones Comerciales
                </label>
                <textarea
                  id="equipment-modal-commercial-observations"
                  value={formData.commercial_observations}
                  onChange={(e) => setFormData({...formData, commercial_observations: e.target.value})}
                  disabled={isCommercialUser}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Ingrese observaciones comerciales..."
                />
              </div>
            </div>

            {/* Material Comercial - Solo para jefe comercial */}
            {isJefeComercial && equipment?.machine_id && (
              <div className="mt-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setCommercialMaterialExpanded(prev => !prev)}
                  className="w-full flex items-center justify-between gap-3 mb-4 text-left hover:opacity-80 transition"
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-[#cf1b22] p-2 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Material Comercial</h3>
                      <p className="text-xs text-gray-600">Fotos y documentos para clientes</p>
                    </div>
                  </div>
                  {commercialMaterialExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  )}
                </button>
                  
                {commercialMaterialExpanded && (
                  <>
                    {/* 1. Fotos Originales De Compra (primero) */}
                    {(() => {
                      const otherPhotos = allPhotos.filter(f => f.scope !== 'EQUIPOS' && f.scope);
                      if (otherPhotos.length === 0) return null;
                      
                      return (
                        <div className="mb-4">
                          <div className="bg-gradient-to-r from-purple-50 to-gray-50 border-2 border-purple-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <ImageIcon className="w-5 h-5 text-purple-600" />
                              <div>
                                <h4 className="text-sm font-bold text-purple-700">
                                  📁 Fotos Originales De Compra
                                </h4>
                                <p className="text-xs text-gray-600">Solo lectura - No se pueden eliminar desde aquí</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-2">
                              {otherPhotos.map((photo) => {
                                const imageUrl = getFilePreviewUrl(photo.id);
                                const moduleLabel = photo.scope || 'GENERAL';
                                return (
                                  <button
                                    type="button"
                                    key={photo.id}
                                    className="relative group cursor-pointer"
                                    onClick={() => globalThis.open(imageUrl, '_blank', 'noopener,noreferrer')}
                                  >
                                    <div className="relative border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-lg hover:border-purple-400 transition-all">
                                      <img 
                                        src={imageUrl} 
                                        alt={photo.file_name} 
                                        className="w-full h-20 object-cover" 
                                      />
                                      {photo.scope && (
                                        <div className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold rounded border bg-purple-100 text-purple-800 border-purple-300">
                                          {moduleLabel.substring(0, 3)}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 2. Fotos de Otros Módulos (para mover a Material Comercial) */}
                    <div className="mb-4">
                      <MachineFilesDragDrop
                        otherPhotos={allPhotos.filter(f => f.scope !== 'EQUIPOS')}
                        onFileMoved={handleFilesMoved}
                      />
                    </div>

                    {/* 3. Fotos Seleccionadas Para Comercial */}
                    <div className="mb-4">
                      <div className="bg-white border-2 border-red-200 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ImageIcon className="w-5 h-5 text-brand-red" />
                          <div>
                            <h4 className="text-sm font-bold text-brand-red">
                              📸 Fotos Seleccionadas Para Comercial
                            </h4>
                            <p className="text-xs text-gray-600">Fotos de Equipos</p>
                          </div>
                        </div>
                        <MachineFiles 
                          key={`photos-${filesRefreshKey}`}
                          machineId={equipment.machine_id}
                          allowUpload={true}
                          allowDelete={true}
                          enablePhotos={true}
                          enableDocs={false}
                          currentScope="EQUIPOS"
                          uploadExtraFields={{ scope: 'EQUIPOS' }}
                          hideOtherModules={true}
                        />
                      </div>
                    </div>
                  </>
                )}

                </div>
              </div>
            )}

            {/* Material Comercial - Solo para usuarios comerciales (solo fotos seleccionadas) */}
            {isCommercialUser && equipment?.machine_id && (
              <div className="mt-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setCommercialMaterialExpanded(prev => !prev)}
                  className="w-full flex items-center justify-between gap-3 mb-4 text-left hover:opacity-80 transition"
                >
                  <div className="flex items-center gap-2">
                    <div className="bg-[#cf1b22] p-2 rounded-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Material Comercial</h3>
                      <p className="text-xs text-gray-600">Fotos y documentos para clientes</p>
                    </div>
                  </div>
                  {commercialMaterialExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  )}
                </button>

                {commercialMaterialExpanded && (
                  <div className="bg-white border-2 border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ImageIcon className="w-5 h-5 text-brand-red" />
                      <div>
                        <h4 className="text-sm font-bold text-brand-red">
                          📸 Fotos Seleccionadas Para Comercial
                        </h4>
                        <p className="text-xs text-gray-600">Fotos de Equipos</p>
                      </div>
                    </div>
                    <MachineFiles 
                      key={`commercial-photos-${filesRefreshKey}`}
                      machineId={equipment.machine_id}
                      allowUpload={false}
                      allowDelete={false}
                      enablePhotos={true}
                      enableDocs={false}
                      currentScope="EQUIPOS"
                      hideOtherModules={true}
                    />
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-xs text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 text-xs bg-[#cf1b22] text-white rounded-lg hover:bg-red-700 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
      )}
    </AnimatePresence>

    {/* Modal de Control de Cambios */}
    <ChangeLogModal
      isOpen={showChangeModal}
      changes={changes}
      onConfirm={(reason) => {
        setShowChangeModal(false);
        saveChanges(reason);
      }}
      onCancel={() => {
        setShowChangeModal(false);
        setPendingUpdate(null);
        setLoading(false);
      }}
    />
    </>
  );
};

