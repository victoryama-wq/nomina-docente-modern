import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, browserSessionPersistence, getAuth, setPersistence } from 'firebase/auth';
import { firebaseConfig } from './config';

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const authPersistenceReady = setPersistence(auth, browserSessionPersistence);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  // hd: 'tecplayacar.edu.mx', // TODO: Descomentar para produccion
  prompt: 'select_account'
});
