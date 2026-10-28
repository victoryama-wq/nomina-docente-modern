import path from 'node:path';
import { config } from '../config.js';
import { DossierError } from './dossier-contract.js';
import { LocalDossierStorage, GoogleDossierStorage } from './dossier-storage.js';
import { validateDocumentContent } from './document-security.js';
import { TeacherDossierService } from './teacher-dossier.js';

export function createDossierService(): TeacherDossierService {
  if (config.DOSSIER_STORAGE_MODE === 'local' && config.DOSSIER_LOCAL_ROOT) {
    const root = path.resolve(config.DOSSIER_LOCAL_ROOT);
    return new TeacherDossierService(new LocalDossierStorage(root), `local:${root}`, bytes => validateDocumentContent(bytes, 'application/pdf'));
  }
  if (config.DOSSIER_STORAGE_MODE === 'gcs' && config.DOSSIER_BUCKET) {
    return new TeacherDossierService(new GoogleDossierStorage(config.DOSSIER_BUCKET), `gcs:${config.DOSSIER_BUCKET}`, bytes => validateDocumentContent(bytes, 'application/pdf'));
  }
  throw new DossierError('DOSSIER_DISABLED', 503, 'El almacenamiento del expediente no esta habilitado.');
}
