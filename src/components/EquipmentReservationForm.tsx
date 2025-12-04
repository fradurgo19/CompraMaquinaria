/**
 * Formulario de Reserva de Equipo
 * Permite a usuarios comerciales reservar equipos adjuntando documentación
 */

import { useState } from 'react';
import { X, Upload, FileText, CheckCircle } from 'lucide-react';
import { Button } from '../atoms/Button';
import { apiPost, apiUpload } from '../services/api';
import { showSuccess, showError } from './Toast';

interface EquipmentReservationFormProps {
  equipment: {
    id: string;
    brand: string;
    model: string;
    serial: string;
    condition: string;
    pvp_est: number | null;
  };
  existingReservation?: {
    id: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    comments: string | null;
    documents: any[];
    approved_at?: string | null;
    rejected_at?: string | null;
    approver_name?: string | null;
    rejector_name?: string | null;
    rejection_reason?: string | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

interface Document {
  id: string;
  name: string;
  file: File;
  uploaded: boolean;
  url?: string;
}

export const EquipmentReservationForm = ({
  equipment,
  existingReservation,
  onClose,
  onSuccess,
}: EquipmentReservationFormProps) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState(existingReservation?.comments || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  
  const isViewMode = !!existingReservation;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newDocuments: Document[] = files.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      file,
      uploaded: false,
    }));
    setDocuments([...documents, ...newDocuments]);
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter((doc) => doc.id !== id));
  };

  const uploadDocument = async (doc: Document, index: number): Promise<string | null> => {
    try {
      setUploadingIndex(index);
      const formData = new FormData();
      formData.append('file', doc.file);
      formData.append('folder', 'equipment-reservations');
      formData.append('equipment_id', equipment.id);

      const response = await apiUpload<{ url: string; path: string }>('/api/upload', formData);
      
      if (response.url) {
        return response.url;
      }
      return null;
    } catch (error) {
      console.error('Error subiendo documento:', error);
      showError('Error al subir el documento: ' + doc.name);
      return null;
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (documents.length === 0) {
      showError('Debes adjuntar al menos un documento');
      return;
    }

    setIsSubmitting(true);

    try {
      // Subir todos los documentos
      const uploadedDocuments = await Promise.all(
        documents.map(async (doc, index) => {
          const url = await uploadDocument(doc, index);
          return {
            name: doc.name,
            url: url || '',
            uploaded: !!url,
          };
        })
      );

      // Verificar que todos los documentos se subieron correctamente
      const failedUploads = uploadedDocuments.filter((doc) => !doc.uploaded);
      if (failedUploads.length > 0) {
        showError(`Error al subir ${failedUploads.length} documento(s)`);
        setIsSubmitting(false);
        return;
      }

      // Crear la reserva
      await apiPost(`/api/equipments/${equipment.id}/reserve`, {
        documents: uploadedDocuments,
        comments: comments.trim() || null,
      });

      showSuccess('Solicitud de reserva enviada exitosamente');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error al crear reserva:', error);
      showError(error.message || 'Error al crear la reserva');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header con colores institucionales */}
        <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Reservar Equipo</h2>
              <p className="text-red-100 mt-1">Adjunta la documentación necesaria</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 transition-colors p-2 rounded-lg hover:bg-white/10"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Características del equipo */}
        <div className="p-6 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Características del Equipo</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Marca</p>
              <p className="text-sm font-medium text-gray-900">{equipment.brand || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Modelo</p>
              <p className="text-sm font-medium text-gray-900">{equipment.model || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Serie</p>
              <p className="text-sm font-medium text-gray-900">{equipment.serial || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Condición</p>
              <p className="text-sm font-medium text-gray-900">{equipment.condition || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">PVP Est.</p>
              <p className="text-sm font-medium text-gray-900">
                {equipment.pvp_est
                  ? `$${equipment.pvp_est.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Adjuntar documentos */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Documentos Adjuntos <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#cf1b22] transition-colors">
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="w-10 h-10 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  Haz clic para seleccionar archivos
                </span>
                <span className="text-xs text-gray-500 mt-1">
                  PDF, DOC, DOCX, JPG, PNG (máx. 10MB por archivo)
                </span>
              </label>
            </div>

            {/* Lista de documentos */}
            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {documents.map((doc, index) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-700 flex-1 truncate">{doc.name}</span>
                      {uploadingIndex === index && (
                        <span className="text-xs text-blue-600">Subiendo...</span>
                      )}
                      {doc.uploaded && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocument(doc.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comentarios */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Comentarios (opcional)
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-transparent"
              placeholder="Agrega cualquier información adicional sobre la reserva..."
              disabled={isViewMode}
            />
          </div>

          {/* Respuesta del Jefe Comercial */}
          {existingReservation && existingReservation.status !== 'PENDING' && (
            <div className={`mb-6 p-4 rounded-lg border-2 ${
              existingReservation.status === 'APPROVED'
                ? 'bg-green-50 border-green-300'
                : 'bg-red-50 border-red-300'
            }`}>
              <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                existingReservation.status === 'APPROVED' ? 'text-green-800' : 'text-red-800'
              }`}>
                <CheckCircle className="w-5 h-5" />
                Respuesta del Jefe Comercial
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Estado:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    existingReservation.status === 'APPROVED'
                      ? 'bg-green-200 text-green-900'
                      : 'bg-red-200 text-red-900'
                  }`}>
                    {existingReservation.status === 'APPROVED' ? '✓ APROBADA' : '✗ RECHAZADA'}
                  </span>
                </div>
                {existingReservation.status === 'APPROVED' && existingReservation.approver_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Aprobado por:</span>
                    <span className="text-sm text-gray-900">{existingReservation.approver_name}</span>
                  </div>
                )}
                {existingReservation.status === 'REJECTED' && existingReservation.rejector_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600">Rechazado por:</span>
                    <span className="text-sm text-gray-900">{existingReservation.rejector_name}</span>
                  </div>
                )}
                {existingReservation.status === 'REJECTED' && existingReservation.rejection_reason && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 block mb-1">Razón del rechazo:</span>
                    <p className="text-sm text-gray-900 bg-white p-3 rounded-md">{existingReservation.rejection_reason}</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                  <span>Fecha de respuesta:</span>
                  <span>
                    {existingReservation.status === 'APPROVED' 
                      ? new Date(existingReservation.approved_at || '').toLocaleString('es-ES')
                      : new Date(existingReservation.rejected_at || '').toLocaleString('es-ES')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              onClick={onClose}
              variant="secondary"
              disabled={isSubmitting}
            >
              {isViewMode ? 'Cerrar' : 'Cancelar'}
            </Button>
            {!isViewMode && (
              <Button
                type="submit"
                disabled={isSubmitting || documents.length === 0}
                className="bg-[#cf1b22] hover:bg-red-700 text-white"
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

