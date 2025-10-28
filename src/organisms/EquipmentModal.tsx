/**
 * Modal para Agregar/Editar Equipos
 * Diseño elegante y empresarial
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Upload, Download } from 'lucide-react';
import { apiPost, apiPut, apiUpload } from '../services/api';
import { showSuccess, showError } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [equipment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
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

      if (equipment) {
        await apiPut(`/api/equipments/${equipment.id}`, data);
        showSuccess('Equipo actualizado exitosamente');
      } else {
        // Aquí se podría implementar la creación de nuevo equipo
        showError('Función de creación pendiente');
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      showError('Error al guardar el equipo');
    } finally {
      setLoading(false);
    }
  };

  const handleExportTemplate = () => {
    // Crear template Excel
    const templateData = [{
      'Serie Completa': '',
      'Estado': 'Disponible',
      'Tipo de Máquina': '',
      'Línea Húmeda': 'SI',
      'Tipo Brazo': 'N/A',
      'Ancho Zapata': '',
      'Capacidad Cucharón': '',
      'Garantía Meses': '',
      'Garantía Horas': '',
      'Marca Motor': 'N/A',
      'Tipo Cabina': 'N/A',
      'Observaciones Comerciales': ''
    }];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipos');
    
    // Establecer ancho de columnas
    ws['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 40 }
    ];

    XLSX.writeFile(wb, 'Template_Equipos.xlsx');
    showSuccess('Plantilla descargada exitosamente');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as any;
          
          // Helper function para convertir a string o mantener vacío
          const toStr = (val: any): string => val != null && val !== '' ? String(val) : '';
          
          // Mapear datos de Excel al formData (mantener como strings para los inputs)
          setFormData({
            full_serial: toStr(firstRow['Serie Completa']),
            state: toStr(firstRow['Estado']) || 'Disponible',
            machine_type: toStr(firstRow['Tipo de Máquina']),
            wet_line: toStr(firstRow['Línea Húmeda']) || 'No',
            arm_type: toStr(firstRow['Tipo Brazo']) || 'N/A',
            track_width: toStr(firstRow['Ancho Zapata']),
            bucket_capacity: toStr(firstRow['Capacidad Cucharón']),
            warranty_months: toStr(firstRow['Garantía Meses']),
            warranty_hours: toStr(firstRow['Garantía Horas']),
            engine_brand: toStr(firstRow['Marca Motor']) || 'N/A',
            cabin_type: toStr(firstRow['Tipo Cabina']) || 'N/A',
            commercial_observations: toStr(firstRow['Observaciones Comerciales']),
          });

          showSuccess('Datos cargados desde Excel exitosamente');
        }
      } catch (error) {
        showError('Error al leer el archivo Excel');
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {equipment ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h2>
              <p className="text-blue-100 text-sm">
                {equipment ? 'Modifica la información del equipo' : 'Completa la información del equipo'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isJefeComercial && (
                <>
                  <button
                    onClick={handleExportTemplate}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Descargar Template
                  </button>
                  <button
                    onClick={handleImportClick}
                    className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition flex items-center gap-2 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Importar Excel
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-lg transition"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Serie Completa */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Serie Completa *
                </label>
                <input
                  type="number"
                  value={formData.full_serial}
                  onChange={(e) => setFormData({...formData, full_serial: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  required
                />
              </div>

              {/* Estado */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado *
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Máquina */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de Máquina
                </label>
                <select
                  value={formData.machine_type}
                  onChange={(e) => setFormData({...formData, machine_type: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">Seleccionar...</option>
                  {MACHINE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Línea Húmeda */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Línea Húmeda
                </label>
                <select
                  value={formData.wet_line}
                  onChange={(e) => setFormData({...formData, wet_line: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {WET_LINE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Tipo Brazo */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo Brazo
                </label>
                <select
                  value={formData.arm_type}
                  onChange={(e) => setFormData({...formData, arm_type: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {ARM_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Ancho Zapata */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Ancho Zapata (mm)
                </label>
                <input
                  type="number"
                  value={formData.track_width}
                  onChange={(e) => setFormData({...formData, track_width: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Capacidad Cucharón */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Capacidad Cucharón (m³)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bucket_capacity}
                  onChange={(e) => setFormData({...formData, bucket_capacity: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Garantía Meses */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Garantía (Meses)
                </label>
                <input
                  type="number"
                  value={formData.warranty_months}
                  onChange={(e) => setFormData({...formData, warranty_months: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Garantía Horas */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Garantía (Horas)
                </label>
                <input
                  type="number"
                  value={formData.warranty_hours}
                  onChange={(e) => setFormData({...formData, warranty_hours: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Marca Motor */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Marca Motor
                </label>
                <select
                  value={formData.engine_brand}
                  onChange={(e) => setFormData({...formData, engine_brand: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {ENGINE_BRANDS.map(brand => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
                </select>
              </div>

              {/* Tipo Cabina */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo Cabina
                </label>
                <select
                  value={formData.cabin_type}
                  onChange={(e) => setFormData({...formData, cabin_type: e.target.value})}
                  disabled={isCommercialUser}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {CABIN_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Observaciones Comerciales */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observaciones Comerciales
                </label>
                <textarea
                  value={formData.commercial_observations}
                  onChange={(e) => setFormData({...formData, commercial_observations: e.target.value})}
                  disabled={isCommercialUser}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Ingrese observaciones comerciales sobre este equipo..."
                />
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

