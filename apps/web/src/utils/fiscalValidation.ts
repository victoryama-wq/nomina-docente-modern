import { ApiRequestError } from '../api';

export const fiscalFieldMessages = {
  rfc: 'RFC: escribe 12 o 13 caracteres, sin espacios: 3 o 4 letras, 6 dígitos y 3 caracteres alfanuméricos; o deja el campo vacío.',
  email: 'Correo: escribe una dirección como nombre@dominio.mx, de hasta 160 caracteres; o deja el campo vacío.',
  fiscalPostalCode: 'C.P. fiscal: escribe cinco dígitos, conservando los ceros iniciales; o deja el campo vacío.',
  curp: 'CURP: escribe 18 caracteres: 4 letras, 6 dígitos, 6 letras, un carácter alfanumérico y un dígito; o deja el campo vacío.',
  paymentType: 'Tipo de pago: selecciona Santander, Banorte o Efectivo.',
  bankDetail: 'Banco / cuenta / CLABE: utiliza como máximo 140 caracteres; o deja el campo vacío.'
} as const;
export type FiscalField = keyof typeof fiscalFieldMessages;
export type FiscalErrors = Partial<Record<FiscalField, string>>;
export const fiscalFields = Object.keys(fiscalFieldMessages) as FiscalField[];

export function validateFiscalFields(values: Record<FiscalField, string>): FiscalErrors {
  const errors: FiscalErrors = {};
  const rfc = values.rfc.trim().toUpperCase();
  const email = values.email.trim();
  const cp = values.fiscalPostalCode.trim();
  const curp = values.curp.trim().toUpperCase();
  if (rfc && !/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) errors.rfc = fiscalFieldMessages.rfc;
  if (email.length > 160 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) errors.email = fiscalFieldMessages.email;
  if (cp && !/^[0-9]{5}$/.test(cp)) errors.fiscalPostalCode = fiscalFieldMessages.fiscalPostalCode;
  if (curp && !/^[A-Z]{4}[0-9]{6}[A-Z]{6}[A-Z0-9][0-9]$/.test(curp)) errors.curp = fiscalFieldMessages.curp;
  if (!['1', '2', 'E'].includes(values.paymentType)) errors.paymentType = fiscalFieldMessages.paymentType;
  if (values.bankDetail.trim().length > 140) errors.bankDetail = fiscalFieldMessages.bankDetail;
  return errors;
}

export function fiscalRequestError(error: unknown): { message: string; fields: FiscalErrors } {
  const fields: FiscalErrors = {};
  if (error instanceof ApiRequestError) {
    if (error.status === 400 && error.code === 'VALIDATION_ERROR') {
      // Only known field/code pairs are rendered; server messages and rejected values never are.
      if (error.fieldErrors && typeof error.fieldErrors === 'object' && !Array.isArray(error.fieldErrors)) {
        for (const field of fiscalFields) {
          if (Object.prototype.hasOwnProperty.call(error.fieldErrors, field)
            && (error.fieldErrors as Record<string, unknown>)[field] === 'INVALID_FORMAT') fields[field] = fiscalFieldMessages[field];
        }
      }
      return { message: 'Revisa los campos fiscales indicados antes de guardar. Tus datos capturados se conservan.', fields };
    }
    if (error.status === 401) return { message: 'Tu sesión venció. Vuelve a iniciar sesión para continuar.', fields };
    if (error.status === 403) return { message: 'Ya no tienes permiso para editar estos datos fiscales.', fields };
    if (error.status === 409) return { message: 'El expediente cambió. Actualízalo y revisa los datos antes de volver a guardar.', fields };
    if (error.status === 429) return { message: 'Hay demasiadas solicitudes. Espera un momento antes de reintentar.', fields };
  }
  return { message: 'No se pudo confirmar el guardado fiscal. Tus datos capturados se conservan; consulta el estado antes de reintentar.', fields };
}
