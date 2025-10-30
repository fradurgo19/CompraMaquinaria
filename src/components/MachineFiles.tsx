import { useEffect, useState } from 'react';
import { Image as ImageIcon, FileText, Download, Trash2, Upload } from 'lucide-react';
import { apiGet, apiUpload, apiDelete, API_URL } from '../services/api';
import { Button } from '../atoms/Button';

interface MachineFile {
  id: string;
  machine_id: string;
  file_name: string;
  file_path: string;
  file_type: 'FOTO' | 'DOCUMENTO';
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  uploaded_by_email?: string;
  scope?: 'GENERAL' | 'LOGISTICA' | 'EQUIPOS' | 'SERVICIO';
}

interface MachineFilesProps {
  machineId: string | null | undefined;
  allowUpload?: boolean; // permite subir archivos
  allowDelete?: boolean; // permite eliminar archivos
  enablePhotos?: boolean; // muestra sección fotos
  enableDocs?: boolean; // muestra sección documentos
  uploadExtraFields?: Record<string, string>; // campos extra para adjuntar (p.ej. scope)
}

export const MachineFiles = ({ machineId, allowUpload = false, allowDelete = true, enablePhotos = true, enableDocs = true, uploadExtraFields = {} }: MachineFilesProps) => {
  const [photos, setPhotos] = useState<MachineFile[]>([]);
  const [docs, setDocs] = useState<MachineFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<FileList | null>(null);
  const [docFiles, setDocFiles] = useState<FileList | null>(null);

  const loadFiles = async () => {
    if (!machineId) return;
    setLoading(true);
    try {
      // Si uploadExtraFields tiene scope, filtrar por ese scope también
      const scope = uploadExtraFields?.scope;
      const url = scope 
        ? `/api/files/${machineId}?scope=${scope}`
        : `/api/files/${machineId}`;
      const all: MachineFile[] = await apiGet(url);
      setPhotos(all.filter(f => f.file_type === 'FOTO'));
      setDocs(all.filter(f => f.file_type === 'DOCUMENTO'));
    } catch {
      setPhotos([]);
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineId]);

  const uploadSelected = async (type: 'FOTO' | 'DOCUMENTO') => {
    if (!machineId) return;
    const files = type === 'FOTO' ? photoFiles : docFiles;
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('machine_id', machineId);
        fd.append('file_type', type);
        Object.entries(uploadExtraFields).forEach(([k, v]) => fd.append(k, v));
        await apiUpload('/api/files', fd);
      }
      await loadFiles();
      setPhotoFiles(null);
      setDocFiles(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiDelete(`/api/files/${id}`);
    await loadFiles();
  };

  const downloadUrl = (id: string) => `${API_URL}/api/files/download/${id}`;

  // Mapeo de colores para etiquetas de módulo
  const getModuleLabel = (scope?: string) => {
    const labels = {
      'LOGISTICA': { text: 'Logística', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      'EQUIPOS': { text: 'Equipos', color: 'bg-green-100 text-green-800 border-green-300' },
      'SERVICIO': { text: 'Servicio', color: 'bg-orange-100 text-orange-800 border-orange-300' },
      'GENERAL': { text: 'General', color: 'bg-gray-100 text-gray-800 border-gray-300' }
    };
    return labels[scope as keyof typeof labels] || labels['GENERAL'];
  };

  return (
    <div className="space-y-6">
      {/* Fotos */}
      {enablePhotos && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-gray-700" /> Fotos
          </h4>
          {allowUpload && (
            <div className="flex items-center gap-2">
              <input type="file" multiple accept="image/*" onChange={(e) => setPhotoFiles(e.target.files)} />
              <Button size="sm" disabled={!photoFiles || !machineId || loading} className="flex items-center gap-1">
                <span onClick={() => uploadSelected('FOTO')} className="flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Subir
                </span>
              </Button>
            </div>
          )}
        </div>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {photos.length === 0 ? (
          <p className="text-sm text-gray-500">Sin fotos</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {photos.map((p) => {
              const moduleLabel = getModuleLabel(p.scope);
              return (
                <div key={p.id} className="relative group border rounded-lg overflow-hidden">
                  <img src={downloadUrl(p.id)} alt={p.file_name} className="w-full h-32 object-cover" />
                  {/* Etiqueta de módulo */}
                  {p.scope && (
                    <div className={`absolute top-2 left-2 px-2 py-1 text-xs font-semibold rounded border ${moduleLabel.color}`}>
                      {moduleLabel.text}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <a href={downloadUrl(p.id)} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs bg-white rounded-md flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Ver</a>
                    {allowDelete && (
                      <button onClick={() => handleDelete(p.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded-md flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/>Borrar</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Documentos */}
      {enableDocs && (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-700" /> Documentos
          </h4>
          {allowUpload && (
            <div className="flex items-center gap-2">
              <input type="file" multiple accept="application/pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(e) => setDocFiles(e.target.files)} />
              <Button size="sm" disabled={!docFiles || !machineId || loading} className="flex items-center gap-1">
                <span onClick={() => uploadSelected('DOCUMENTO')} className="flex items-center gap-1">
                  <Upload className="w-4 h-4" /> Subir
                </span>
              </Button>
            </div>
          )}
        </div>
        {docs.length === 0 ? (
          <p className="text-sm text-gray-500">Sin documentos</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border">
            {docs.map((d) => {
              const moduleLabel = getModuleLabel(d.scope);
              return (
                <li key={d.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800">{d.file_name}</p>
                        {/* Etiqueta de módulo */}
                        {d.scope && (
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${moduleLabel.color}`}>
                            {moduleLabel.text}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{new Date(d.uploaded_at).toLocaleString('es-CO')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={downloadUrl(d.id)} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs bg-white border rounded-md flex items-center gap-1"><Download className="w-3.5 h-3.5"/>Descargar</a>
                    {allowDelete && (
                      <button onClick={() => handleDelete(d.id)} className="px-2 py-1 text-xs bg-red-600 text-white rounded-md flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/>Borrar</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}
    </div>
  );
};


