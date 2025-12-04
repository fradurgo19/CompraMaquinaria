/**
 * Modal para Agregar/Editar Equipos
 * Diseño elegante y empresarial
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'lucide-react';
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
  equipment?: any;
  onSuccess: () => void;
}

const MACHINE_TYPES = [
  'BRAZO LARGO 30 TON', 'GRUA HITACHI ZX75UR', 'ACOPLE RAPIDO 12TON', 'MARUJUN TELESCOPIC ARM',
  'MANDIBULA MINICARGADOR', 'ENGANCHE PARA EXCAVADORA 20TON', 'CHASIS LBX460', 'BRAZO LARGO 20 TON',
  'ALMEJA GIRATORIA 20TON', 'BALDE SH240-5', 'MOTOSOLDADOR MULTIQUIP', 'BALDE USADO 3TON',
  'BALDE USADO 20 TON', 'BRAZO ESTANDAR 20 TON', 'LINEA HUMEDA ZX200', 'LINEA HUMEDA SK210',
  'BROCA PARA AHOYADOR', 'BRAZO LARGO 16.5MTS', 'MARTILLO HIDRAULICO OKADA',
  'MASTIL DE PERFORACIÓN TECOP MCD45HP', 'BARREDORA PARA MINICARGADOR',
  'MONTACARGAS LIUGONG F7035M', 'RETROCARGADOR CASE 580N', 'PONTONES GET240D',
  'VIBROCOMPACTADORAMMANNASC70', 'EXCAVADORA LBX 210X3E', 'MINICARGADOR CASE SR200B',
  'ALIMENTADOR VIBRATORIO - ZSW600x150', 'EXCAVADORA KOBELCO SK330LC',
  'MINIEXCAVADORA HITACHI EX5-2', 'EXCAVADORA SUMITOMO SH210-5',
  'RETROCARGADOR CASE 575SV', 'EXCAVADORA HITACHI ZX75US-3', 'EXCAVADORA KUBOTA K70-3',
  'EXCAVADORA HITACHI ZX120-3', 'EXCAVADORA CASE CX240C-8',
  'EXCAVADORA HITACHI ZX210LC-5B', 'MINIEXCAVADORA YANMAR VIO35-7',
  'BALDE EXCAVADORA (ROCK DUTY)', 'RODILLO VIBRATORIO PARA MINICARGADOR',
  'BRAZO EXCAVADOR PARA MINICARGADOR', 'MOTONIVELADORA CASE 845B-2',
  'PULVERIZADORA NPK', 'MARTILLO HIDRAULICO FURUKAWA',
  'EXTENDEDORA DE ASFALTO SIMEX', 'CANGURO AMMANN ACR70D',
  'MINIEXCAVADORA YANMAR VIO17-1B', 'MINIEXCAVADORA YANMAR VIO35-6B',
  'VIBROCOMPACTADOR AMMANN ARX 26-2', 'MINICARGADOR CASE SR175B',
  'MINICARGADOR CASE SR220B', 'VIBROCOMPACTADOR CASE 1107EX',
  'EXCAVADORA YANMAR VIO80-1', 'EXCAVADORA HITACHI ZX130-5G',
  'BULLDOZER CATERPILLAR D3C', 'BULLDOZER KOMATSU D39PX',
  'EXCAVADORA YANMAR VIO70-3', 'MINIEXCAVADORA AIRMAN AX50U-3',
  'MINIEXCAVADORA HITACHI ZX30U-5A', 'MINIEXCAVADORA HITACHI ZX35U-5A',
  'EXCAVADORA LBX130X3E', 'EXCAVADORA KUBOTA K120-3',
  'EXCAVADORA SUMITOMO SH200-5', 'EXCAVADORA HITACHI ZX200-5',
  'EXCAVADORA HITACHI ZX210LCH-5G', 'EXCAVADORA HITACHI ZX135US-3',
  'MINICARGADOR CASE SR210B', 'EXCAVADORA HITACHI ZX350LC-5B',
  'EXCAVADORA HITACHI ZX75US-5B', 'EXCAVADORA HITACHI ZX200-6',
  'EXCAVADORA HITACHI ZX130-5B', 'EXCAVADORA HITACHI ZX225US-5B',
  'VOLQUETA * CHASIS MERCEDES-BENZ ATEGO 1726K', 'EXCAVADORA HITACHI ZX200-5B',
  'EXCAVADORA HITACHI ZX210K-5B', 'RETROCARGADOR CASE 580SV',
  'EXCAVADORA HITACHI ZX120-5B', 'MINIEXCAVADORA HITACHI ZX40U-5B',
  'EXCAVADORA HITACHI ZX330', 'EXCAVADORA HITACHI ZX200X-5B-U'
];

const STATES = ['Libre', 'Ok dinero y OC', 'Lista, Pendiente Entrega', 'Reservada', 'Disponible', 'Reservada con Dinero', 'Reservada sin Dinero'];
const WET_LINE_OPTIONS = ['SI', 'No'];
const ARM_TYPE_OPTIONS = ['ESTANDAR', 'N/A'];
const ENGINE_BRANDS = ['N/A', 'ISUZU', 'MITSUBISHI', 'FPT', 'YANMAR', 'KUBOTA', 'PERKINS', 'CUMMINS', 'CATERPILLAR', 'KOMATSU'];
const CABIN_TYPES = ['N/A', 'CABINA CERRADA / AIRE ACONDICIONADO', 'CANOPY'];

export const EquipmentModal = ({ isOpen, onClose, equipment, onSuccess }: EquipmentModalProps) => {
  const { userProfile } = useAuth();
  const isCommercialUser = userProfile?.role === 'comerciales';
  const isJefeComercial = userProfile?.role === 'jefe_comercial';
  const [formData, setFormData] = useState({
    full_serial: '',
    state: 'Disponible',
    machine_type: '',
    wet_line: 'No',
    arm_type: 'N/A',
    track_width: '',
    bucket_capacity: '',
    warranty_months: '',
    warranty_hours: '',
    engine_brand: 'N/A',
    cabin_type: 'N/A',
    commercial_observations: '',
  });
  const [loading, setLoading] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);
  const [allPhotos, setAllPhotos] = useState<any[]>([]);
  const [filesRefreshKey, setFilesRefreshKey] = useState(0);

  // Campos a monitorear para control de cambios
  const MONITORED_FIELDS = {
    state: 'Estado',
    machine_type: 'Tipo de Máquina',
    wet_line: 'Línea Húmeda',
    arm_type: 'Tipo de Brazo',
    track_width: 'Ancho Zapatas',
    bucket_capacity: 'Capacidad Cucharón',
    warranty_months: 'Garantía Meses',
    warranty_hours: 'Garantía Horas',
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
        full_serial: equipment.full_serial || '',
        state: equipment.state || 'Disponible',
        machine_type: equipment.machine_type || '',
        wet_line: equipment.wet_line || 'No',
        arm_type: equipment.arm_type || 'N/A',
        track_width: equipment.track_width || '',
        bucket_capacity: equipment.bucket_capacity || '',
        warranty_months: equipment.warranty_months || '',
        warranty_hours: equipment.warranty_hours || '',
        engine_brand: equipment.engine_brand || 'N/A',
        cabin_type: equipment.cabin_type || 'N/A',
        commercial_observations: equipment.commercial_observations || '',
      });
      
      // Cargar fotos de todos los módulos para drag & drop
      if (equipment.machine_id && isJefeComercial) {
        loadAllPhotos(equipment.machine_id);
      }
    } else {
      setFormData({
        full_serial: '',
        state: 'Disponible',
        machine_type: '',
        wet_line: 'No',
        arm_type: 'N/A',
        track_width: '',
        bucket_capacity: '',
        warranty_months: '',
        warranty_hours: '',
        engine_brand: 'N/A',
        cabin_type: 'N/A',
        commercial_observations: '',
      });
    }
  }, [equipment, isJefeComercial]);

  const loadAllPhotos = async (machineId: string) => {
    try {
      const files = await apiGet<any[]>(`/api/files/${machineId}`);
      setAllPhotos(files.filter(f => f.file_type === 'FOTO'));
    } catch (error) {
      console.error('Error cargando fotos:', error);
    }
  };

  const handleFilesMoved = () => {
    if (equipment?.machine_id) {
      loadAllPhotos(equipment.machine_id);
    }
    setFilesRefreshKey(prev => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let data: any = {};
    
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
        warranty_months: formData.warranty_months ? Number(formData.warranty_months) : null,
        warranty_hours: formData.warranty_hours ? Number(formData.warranty_hours) : null,
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
        warranty_months: formData.warranty_months ? Number(formData.warranty_months) : null,
        warranty_hours: formData.warranty_hours ? Number(formData.warranty_hours) : null,
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
          <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[calc(85vh-100px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Estado */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Estado *
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22]"
                >
                  {STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              {/* Garantía Meses */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Garantía (Meses)
                </label>
                <input
                  type="number"
                  value={formData.warranty_months}
                  onChange={(e) => setFormData({...formData, warranty_months: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Garantía Horas */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Garantía (Horas)
                </label>
                <input
                  type="number"
                  value={formData.warranty_hours}
                  onChange={(e) => setFormData({...formData, warranty_hours: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Observaciones Comerciales */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Observaciones Comerciales
                </label>
                <textarea
                  value={formData.commercial_observations}
                  onChange={(e) => setFormData({...formData, commercial_observations: e.target.value})}
                  disabled={isCommercialUser}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#cf1b22] focus:border-[#cf1b22] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Ingrese observaciones comerciales..."
                />
              </div>
            </div>

            {isJefeComercial && equipment?.machine_id && (
              <div className="mt-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
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
                  
                  <MachineFiles 
                    key={filesRefreshKey}
                    machineId={equipment.machine_id}
                    allowUpload={true}
                    allowDelete={true}
                    currentScope="EQUIPOS"
                    uploadExtraFields={{ scope: 'EQUIPOS' }}
                  />
                  
                  {/* Drag & Drop para mover fotos de otros módulos */}
                  {isJefeComercial && (
                    <MachineFilesDragDrop
                      otherPhotos={allPhotos.filter(f => f.scope !== 'EQUIPOS')}
                      equipmentPhotos={allPhotos.filter(f => f.scope === 'EQUIPOS')}
                      onFileMoved={handleFilesMoved}
                    />
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

