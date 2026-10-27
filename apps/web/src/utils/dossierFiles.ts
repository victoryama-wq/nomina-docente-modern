export const MAX_DOSSIER_BYTES = 7.5 * 1024 * 1024;
export const MAX_DOSSIER_SELECTION = 10;

export function validateDossierFile(file: File): string {
  if (!/\.pdf$/i.test(file.name) || (file.type && file.type !== 'application/pdf')) return 'Solo se admiten archivos PDF.';
  if (!file.size) return 'El archivo está vacío.';
  if (file.size > MAX_DOSSIER_BYTES) return 'El PDF excede 7.5 MiB.';
  if (file.name.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(file.name)) return 'El nombre del archivo no es válido (máximo 180 caracteres).';
  return '';
}

export function dossierFilePayload(file: File): Promise<{ fileName: string; mimeType: 'application/pdf'; base64Data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FILE_READ_FAILED'));
    reader.onload = () => resolve({ fileName: file.name, mimeType: 'application/pdf', base64Data: String(reader.result).split(',')[1] || '' });
    reader.readAsDataURL(file);
  });
}
