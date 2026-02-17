/**
 * Formulario de Reserva de Equipo
 * Permite a usuarios comerciales reservar equipos adjuntando documentación
 */

import { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle } from 'lucide-react';
import { Button } from '../atoms/Button';
import { apiPost, apiUpload, apiGet, apiPut } from '../services/api';
import { showSuccess, showError } from './Toast';
import { useAuth } from '../context/AuthContext';

type ReservationDocument = {
  url?: string | null;
  name?: string | null;
  type?: string | null;
  uploaded?: boolean;
};

type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

type ReservationRecord = {
  id: string;
  status: ReservationStatus;
  comments: string | null;
  documents: ReservationDocument[];
  approved_at?: string | null;
  rejected_at?: string | null;
  approver_name?: string | null;
  rejector_name?: string | null;
  rejection_reason?: string | null;
  consignacion_10_millones?: boolean | null;
  porcentaje_10_valor_maquina?: boolean | null;
  firma_documentos?: boolean | null;
  first_checklist_date?: string | null;
  created_at?: string;
};

type ChecklistField = 'consignacion_10_millones' | 'porcentaje_10_valor_maquina' | 'firma_documentos';

type UploadedDocument = {
  name: string;
  url: string;
  uploaded: boolean;
};

interface EquipmentReservationFormProps {
  equipment: {
    id: string;
    brand: string;
    model: string;
    serial: string;
    condition: string;
    pvp_est: number | null;
    cliente?: string | null;
    asesor?: string | null;
  };
  existingReservation?: ReservationRecord;
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getChecklistProgressMessage(checkedCount: number): string {
  if (checkedCount === 1 || checkedCount === 2) {
    return 'Checklist actualizado. El estado cambió a "Separada" con 10 días de límite.';
  }
  return 'Checklist actualizado';
}

function getSubmitButtonLabel(isSubmitting: boolean, canAddDocuments: boolean): string {
  if (isSubmitting) {
    return canAddDocuments ? 'Agregando...' : 'Enviando...';
  }
  return canAddDocuments ? 'Agregar Documentos' : 'Enviar Solicitud';
}

type ChecklistSectionProps = {
  consignacion10M: boolean;
  porcentaje10: boolean;
  firmaDocumentos: boolean;
  hasExceeded10Days: boolean;
  allCheckboxesChecked: boolean;
  daysSinceFirstCheck: number;
  onConsignacionChange: (checked: boolean) => void;
  onPorcentajeChange: (checked: boolean) => void;
  onFirmaChange: (checked: boolean) => void;
};

function ChecklistSection({
  consignacion10M,
  porcentaje10,
  firmaDocumentos,
  hasExceeded10Days,
  allCheckboxesChecked,
  daysSinceFirstCheck,
  onConsignacionChange,
  onPorcentajeChange,
  onFirmaChange,
}: Readonly<ChecklistSectionProps>) {
  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="text-sm font-semibold text-yellow-900 mb-3">Checklist de Aprobación</h3>
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consignacion10M}
            onChange={(e) => {
              onConsignacionChange(e.target.checked);
            }}
            className="w-5 h-5 text-[#cf1b22] border-gray-300 rounded focus:ring-[#cf1b22]"
            disabled={hasExceeded10Days}
          />
          <span className={`text-sm ${hasExceeded10Days ? 'text-gray-400' : 'text-gray-700'}`}>
            1. Consignación de 10 millones y/o VoBo Director
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={porcentaje10}
            onChange={(e) => {
              onPorcentajeChange(e.target.checked);
            }}
            className="w-5 h-5 text-[#cf1b22] border-gray-300 rounded focus:ring-[#cf1b22]"
            disabled={hasExceeded10Days || !consignacion10M}
          />
          <span className={`text-sm ${hasExceeded10Days || !consignacion10M ? 'text-gray-400' : 'text-gray-700'}`}>
            2. 10% Valor de la máquina {!consignacion10M && '(Marque primero el checklist 1)'}
          </span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={firmaDocumentos}
            onChange={(e) => {
              onFirmaChange(e.target.checked);
            }}
            className="w-5 h-5 text-[#cf1b22] border-gray-300 rounded focus:ring-[#cf1b22]"
            disabled={hasExceeded10Days || !consignacion10M || !porcentaje10}
          />
          <span className={`text-sm ${hasExceeded10Days || !consignacion10M || !porcentaje10 ? 'text-gray-400' : 'text-gray-700'}`}>
            3. Checklist Firma de Documentos {(!consignacion10M || !porcentaje10) && '(Marque primero los checklists 1 y 2)'}
          </span>
        </label>
      </div>
      {hasExceeded10Days && !allCheckboxesChecked && (
        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded text-sm text-red-800">
          ⚠️ Han pasado más de 10 días y el checklist no está completo. La máquina será liberada automáticamente.
        </div>
      )}
      {!hasExceeded10Days && (
        <div className="mt-3 text-xs text-gray-600">
          Días transcurridos desde el primer checklist: {daysSinceFirstCheck} / 8 días límite
        </div>
      )}
    </div>
  );
}

type ReservationResponseSectionProps = {
  existingReservation: ReservationRecord;
};

function ReservationResponseSection({ existingReservation }: Readonly<ReservationResponseSectionProps>) {
  const isApproved = existingReservation.status === 'APPROVED';
  const containerClass = isApproved ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300';
  const titleClass = isApproved ? 'text-green-800' : 'text-red-800';
  const badgeClass = isApproved ? 'bg-green-200 text-green-900' : 'bg-red-200 text-red-900';
  const statusLabel = isApproved ? '✓ APROBADA' : '✗ RECHAZADA';
  const responseDate = isApproved
    ? new Date(existingReservation.approved_at ?? '').toLocaleString('es-ES')
    : new Date(existingReservation.rejected_at ?? '').toLocaleString('es-ES');

  return (
    <div className={`mb-6 p-4 rounded-lg border-2 ${containerClass}`}>
      <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${titleClass}`}>
        <CheckCircle className="w-5 h-5" />
        Respuesta del Jefe Comercial
      </h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Estado:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
            {statusLabel}
          </span>
        </div>
        {isApproved && existingReservation.approver_name && (
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
          <span>{responseDate}</span>
        </div>
      </div>
    </div>
  );
}

type LastReservationInfoSectionProps = {
  isJefeComercial: boolean;
  cliente?: string | null;
  asesor?: string | null;
  lastReservation: ReservationRecord | null;
};

function LastReservationInfoSection({
  isJefeComercial,
  cliente,
  asesor,
  lastReservation,
}: Readonly<LastReservationInfoSectionProps>) {
  const shouldShow = isJefeComercial && (cliente || asesor || lastReservation);
  if (!shouldShow) return null;

  return (
    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="text-sm font-semibold text-blue-900 mb-2">Última Reserva</h3>
      <div className="space-y-1 text-sm text-blue-800">
        {cliente && (
          <p><span className="font-medium">Cliente:</span> {cliente}</p>
        )}
        {asesor && (
          <p><span className="font-medium">Asesor:</span> {asesor}</p>
        )}
        {lastReservation && (
          <>
            <p><span className="font-medium">Documentos:</span> {lastReservation.documents?.length || 0} archivo(s)</p>
            <p><span className="font-medium">Fecha:</span> {new Date(lastReservation.created_at ?? '').toLocaleString('es-ES')}</p>
            {lastReservation.comments && (
              <p><span className="font-medium">Comentarios:</span> {lastReservation.comments}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const EquipmentReservationForm = ({
  equipment,
  existingReservation,
  onClose,
  onSuccess,
}: EquipmentReservationFormProps) => {
  const { userProfile } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [comments, setComments] = useState(existingReservation?.comments || '');
  const [cliente, setCliente] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [lastReservation, setLastReservation] = useState<ReservationRecord | null>(null);
  const [consignacion10M, setConsignacion10M] = useState(existingReservation?.consignacion_10_millones || false);
  const [porcentaje10, setPorcentaje10] = useState(existingReservation?.porcentaje_10_valor_maquina || false);
  const [firmaDocumentos, setFirmaDocumentos] = useState(existingReservation?.firma_documentos || false);
  
  const isViewMode = !!existingReservation;
  const isJefeComercial = userProfile?.role === 'jefe_comercial';
  const isCommercial = userProfile?.role === 'comerciales';
  
  // Calcular días desde first_checklist_date o created_at
  const firstCheckDate = existingReservation?.first_checklist_date || existingReservation?.created_at;
  const daysSinceFirstCheck = firstCheckDate
    ? Math.floor((Date.now() - new Date(firstCheckDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  const hasExceeded10Days = daysSinceFirstCheck > 7;

  const canAddDocuments = isCommercial && existingReservation?.status === 'PENDING' && !hasExceeded10Days;
  const canSubmit = !isViewMode || canAddDocuments;

  const allCheckboxesChecked = consignacion10M && porcentaje10 && firmaDocumentos;
  
  // Cargar última reserva para jefecomercial y actualizar checkboxes si hay existingReservation
  useEffect(() => {
    if (isJefeComercial && equipment.id) {
      const loadLastReservation = async () => {
        try {
          const reservations = await apiGet<ReservationRecord[]>(`/api/equipments/${equipment.id}/reservations`);
          if (reservations && reservations.length > 0) {
            const sortedReservations = [...reservations].sort((a, b) =>
              new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
            );
            setLastReservation(sortedReservations[0]);
          }
        } catch (error) {
          console.error('Error al cargar última reserva:', error);
        }
      };
      loadLastReservation();
    }
    
    // Si hay existingReservation, cargar valores de checklist
    if (existingReservation) {
      setConsignacion10M(existingReservation.consignacion_10_millones || false);
      setPorcentaje10(existingReservation.porcentaje_10_valor_maquina || false);
      setFirmaDocumentos(existingReservation.firma_documentos || false);
    }
  }, [equipment.id, isJefeComercial, existingReservation]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newDocuments: Document[] = files.map((file) => ({
      id: crypto.randomUUID(),
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

  const uploadSelectedDocuments = async (): Promise<UploadedDocument[] | null> => {
    const uploadedDocuments = await Promise.all(
      documents.map(async (doc, index) => {
        const url = await uploadDocument(doc, index);
        return {
          name: doc.name,
          url: url || '',
          uploaded: Boolean(url),
        };
      })
    );

    const failedUploads = uploadedDocuments.filter((doc) => !doc.uploaded);
    if (failedUploads.length > 0) {
      showError(`Error al subir ${failedUploads.length} documento(s)`);
      return null;
    }

    return uploadedDocuments;
  };

  const submitAdditionalDocuments = async (uploadedDocuments: UploadedDocument[]) => {
    if (!existingReservation) return;
    await apiPut(`/api/equipments/reservations/${existingReservation.id}/add-documents`, {
      documents: uploadedDocuments,
    });
    showSuccess('Documentos agregados exitosamente');
  };

  const submitNewReservation = async (uploadedDocuments: UploadedDocument[]) => {
    await apiPost(`/api/equipments/${equipment.id}/reserve`, {
      documents: uploadedDocuments,
      comments: comments.trim() || null,
      cliente: cliente.trim() || null,
    });
    showSuccess('Solicitud de reserva enviada exitosamente');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isAddingDocuments = Boolean(existingReservation && canAddDocuments);
    if (documents.length === 0) {
      showError(
        isAddingDocuments
          ? 'Debes seleccionar al menos un documento para agregar'
          : 'Debes adjuntar al menos un documento'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedDocuments = await uploadSelectedDocuments();
      if (!uploadedDocuments) return;

      if (isAddingDocuments) {
        await submitAdditionalDocuments(uploadedDocuments);
      } else {
        await submitNewReservation(uploadedDocuments);
      }

      onSuccess();
      onClose();
    } catch (error: unknown) {
      const fallback = isAddingDocuments ? 'Error al agregar documentos' : 'Error al crear la reserva';
      console.error(fallback, error);
      showError(getErrorMessage(error, fallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateChecklistField = async (field: ChecklistField, value: boolean): Promise<boolean> => {
    if (!existingReservation?.id) return false;
    try {
      await apiPut(`/api/equipments/reservations/${existingReservation.id}/update-checklist`, {
        [field]: value,
      });
      return true;
    } catch (error: unknown) {
      console.error('Error actualizando checklist:', error);
      showError(getErrorMessage(error, 'Error al actualizar checklist'));
      return false;
    }
  };

  const approveReservation = async (): Promise<boolean> => {
    if (!existingReservation?.id) return false;
    try {
      await apiPut(`/api/equipments/reservations/${existingReservation.id}/approve`, {});
      return true;
    } catch (error: unknown) {
      console.error('Error aprobando reserva:', error);
      showError(getErrorMessage(error, 'Error al aprobar la reserva'));
      return false;
    }
  };

  const handleConsignacionChange = async (checked: boolean) => {
    if (!checked) {
      setConsignacion10M(false);
      const updated = await updateChecklistField('consignacion_10_millones', false);
      if (!updated) {
        setConsignacion10M(true);
        return;
      }
      showSuccess('Checklist actualizado');
      onSuccess();
      return;
    }

    const confirmed = globalThis.confirm(
      '¿Está seguro de marcar "Consignación de 10 millones y/o VoBo Director"?\n\n' +
      'Al marcar este checklist, el estado cambiará a "Separada" si es el primer o segundo checklist, ' +
      'o a "Reservada" si completa los tres.'
    );
    if (!confirmed) return;

    setConsignacion10M(true);
    const updated = await updateChecklistField('consignacion_10_millones', true);
    if (!updated) {
      setConsignacion10M(false);
      return;
    }

    const checkedCount = 1 + Number(porcentaje10) + Number(firmaDocumentos);
    showSuccess(getChecklistProgressMessage(checkedCount));
    onSuccess();
  };

  const handlePorcentajeChange = async (checked: boolean) => {
    if (!checked) {
      setPorcentaje10(false);
      const updated = await updateChecklistField('porcentaje_10_valor_maquina', false);
      if (!updated) {
        setPorcentaje10(true);
        return;
      }
      showSuccess('Checklist actualizado');
      onSuccess();
      return;
    }

    if (!consignacion10M) {
      showError('Debe marcar primero "Consignación de 10 millones y/o VoBo Director"');
      return;
    }

    const confirmed = globalThis.confirm(
      '¿Está seguro de marcar "10% Valor de la máquina"?\n\n' +
      'Al marcar este checklist, el estado cambiará a "Separada" si es el segundo checklist, ' +
      'o a "Reservada" si completa los tres.'
    );
    if (!confirmed) return;

    setPorcentaje10(true);
    const updated = await updateChecklistField('porcentaje_10_valor_maquina', true);
    if (!updated) {
      setPorcentaje10(false);
      return;
    }

    const checkedCount = Number(consignacion10M) + 1 + Number(firmaDocumentos);
    showSuccess(getChecklistProgressMessage(checkedCount));
    onSuccess();
  };

  const handleFirmaDocumentosChange = async (checked: boolean) => {
    if (!checked) {
      setFirmaDocumentos(false);
      const updated = await updateChecklistField('firma_documentos', false);
      if (!updated) {
        setFirmaDocumentos(true);
        return;
      }
      showSuccess('Checklist actualizado');
      onSuccess();
      return;
    }

    if (!consignacion10M || !porcentaje10) {
      showError('Debe marcar primero "Consignación de 10 millones y/o VoBo Director" y "10% Valor de la máquina"');
      return;
    }

    const confirmed = globalThis.confirm(
      '¿Está seguro de aprobar la reserva?\n\n' +
      'Al marcar este último checklist, el estado cambiará a "Reservada" por 30 días desde hoy.'
    );
    if (!confirmed) return;

    setFirmaDocumentos(true);
    const updated = await updateChecklistField('firma_documentos', true);
    if (!updated) {
      setFirmaDocumentos(false);
      return;
    }

    const approved = await approveReservation();
    if (!approved) {
      setFirmaDocumentos(false);
      return;
    }

    showSuccess('Reserva aprobada exitosamente. Estado cambiado a "Reservada" por 30 días.');
    onSuccess();
  };

  const documentsRequiredMark = canAddDocuments ? '' : '*';
  const submitButtonLabel = getSubmitButtonLabel(isSubmitting, canAddDocuments);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header con colores institucionales */}
        <div className="bg-gradient-to-r from-[#cf1b22] to-red-700 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">
                {canAddDocuments ? 'Actualizar Documentación de Reserva' : 'Reservar Equipo'}
              </h2>
              <p className="text-red-100 mt-1">
                {canAddDocuments
                  ? 'Adjunta información adicional sobre la misma reserva'
                  : 'Adjunta la documentación necesaria'}
              </p>
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
          <LastReservationInfoSection
            isJefeComercial={isJefeComercial}
            cliente={equipment.cliente}
            asesor={equipment.asesor}
            lastReservation={lastReservation}
          />

          {/* Campo Cliente */}
          <div className="mb-6">
            <label htmlFor="reservation-client-input" className="block text-sm font-medium text-gray-700 mb-2">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              id="reservation-client-input"
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-transparent"
              placeholder="Ingrese el nombre del cliente"
              disabled={isViewMode}
              required
            />
          </div>

          {/* Adjuntar documentos */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {canAddDocuments ? 'Agregar Documentos Adicionales' : 'Documentos Adjuntos'} <span className="text-red-500">{documentsRequiredMark}</span>
            </label>
            {canAddDocuments && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Puedes agregar documentos adicionales durante los 10 días siguientes a la solicitud.
                  Días restantes: {10 - daysSinceFirstCheck} / 10
                </p>
              </div>
            )}
            {existingReservation?.documents && existingReservation.documents.length > 0 && (
              <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-xs font-semibold text-gray-700 mb-2">Documentos existentes:</p>
                <div className="space-y-1">
                  {existingReservation.documents.map((doc) => (
                    <div key={doc.url ?? `${doc.name ?? 'Documento'}-${doc.type ?? 'archivo'}`} className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="w-3 h-3" />
                      <span>{doc.name || 'Documento'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              canAddDocuments ? 'border-blue-300 hover:border-blue-400' : 'border-gray-300 hover:border-[#cf1b22]'
            } ${canAddDocuments ? '' : 'cursor-not-allowed opacity-50'}`}>
              <input
                type="file"
                id="file-upload"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={!canAddDocuments && !!existingReservation}
              />
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center ${canAddDocuments || !existingReservation ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <Upload className={`w-10 h-10 mb-2 ${canAddDocuments ? 'text-blue-400' : 'text-gray-400'}`} />
                <span className={`text-sm ${canAddDocuments ? 'text-blue-600' : 'text-gray-600'}`}>
                  {canAddDocuments ? 'Haz clic para agregar más archivos' : 'Haz clic para seleccionar archivos'}
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
            <label htmlFor="reservation-comments-input" className="block text-sm font-medium text-gray-700 mb-2">
              Comentarios (opcional)
            </label>
            <textarea
              id="reservation-comments-input"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#cf1b22] focus:border-transparent"
              placeholder="Agrega cualquier información adicional sobre la reserva..."
              disabled={isViewMode}
            />
          </div>

          {/* Checklist para jefecomercial */}
          {isJefeComercial && existingReservation?.status === 'PENDING' && (
            <ChecklistSection
              consignacion10M={consignacion10M}
              porcentaje10={porcentaje10}
              firmaDocumentos={firmaDocumentos}
              hasExceeded10Days={hasExceeded10Days}
              allCheckboxesChecked={allCheckboxesChecked}
              daysSinceFirstCheck={daysSinceFirstCheck}
              onConsignacionChange={(checked) => {
                void handleConsignacionChange(checked);
              }}
              onPorcentajeChange={(checked) => {
                void handlePorcentajeChange(checked);
              }}
              onFirmaChange={(checked) => {
                void handleFirmaDocumentosChange(checked);
              }}
            />
          )}

          {/* Respuesta del Jefe Comercial */}
          {existingReservation && existingReservation.status !== 'PENDING' && (
            <ReservationResponseSection existingReservation={existingReservation} />
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
            {canSubmit && (
              <Button
                type="submit"
                disabled={isSubmitting || documents.length === 0}
                className="bg-[#cf1b22] hover:bg-red-700 text-white"
              >
                {submitButtonLabel}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

