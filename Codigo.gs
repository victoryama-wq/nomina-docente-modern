// Función principal que sirve la interfaz web
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('App de Nómina Docente')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0'); // Hace que sea responsiva
}

// -----------------------------------------------------------------------------
// BLOQUE DE SEGURIDAD Y UTILIDADES
// -----------------------------------------------------------------------------
function obtenerTimezone_() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  return (libro && libro.getSpreadsheetTimeZone()) || Session.getScriptTimeZone() || 'America/Cancun';
}

function obtenerRegistroUsuario_(usuario) {
  const hojaCoords = asegurarHojaUsuariosAcceso_(SpreadsheetApp.getActiveSpreadsheet());
  if (!hojaCoords || hojaCoords.getLastRow() < 2) return null;

  const datos = hojaCoords.getRange(2, 1, hojaCoords.getLastRow() - 1, Math.max(hojaCoords.getLastColumn(), USUARIOS_ACCESO_HEADERS_.length)).getValues();
  const usuarioBuscado = (usuario || '').toString().trim().toLowerCase();

  for (let i = 0; i < datos.length; i++) {
    const fila = datos[i];
    const nombre = (fila[0] || '').toString().trim();
    const observacion = (fila[1] || '').toString().trim();
    const usuarioFila = (fila[2] || '').toString().trim();
    const passFila = (fila[3] || '').toString().trim();
    const rol = normalizarRolUsuarioAcceso_(fila[4] || 'coordinador');
    const estatus = normalizarEstatusUsuarioAcceso_(fila[5] || 'ACTIVO');

    if (usuarioFila.toLowerCase() === usuarioBuscado) {
      return {
        filaHoja: i + 2,
        nombre: nombre,
        observacion: observacion,
        usuario: usuarioFila,
        pass: passFila,
        rol: rol,
        estatus: estatus,
        fechaCreacion: (fila[6] || '').toString().trim(),
        creadoPor: (fila[7] || '').toString().trim(),
        fechaActualizacion: (fila[8] || '').toString().trim(),
        actualizadoPor: (fila[9] || '').toString().trim(),
        esAdmin: rol === 'admin'
      };
    }
  }

  return null;
}

function crearSesionSegura_(usuario, nombre, rol) {
  const token = Utilities.getUuid();
  const payload = {
    usuario: (usuario || '').toString().trim(),
    nombre: (nombre || '').toString().trim(),
    rol: (rol || 'coordinador').toString().trim().toLowerCase(),
    esAdmin: ((rol || '').toString().trim().toLowerCase() === 'admin'),
    creada: new Date().toISOString()
  };

  CacheService.getScriptCache().put('nomina_session_' + token, JSON.stringify(payload), 21600);
  return { token: token, sesion: payload };
}

function obtenerSesionSegura_(token) {
  if (!token) return null;

  const raw = CacheService.getScriptCache().get('nomina_session_' + token);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function validarSesionSegura_(token) {
  const sesion = obtenerSesionSegura_(token);
  if (!sesion) {
    throw new Error('Sesión inválida o expirada. Vuelve a iniciar sesión.');
  }

  const registroActual = obtenerRegistroUsuario_(sesion.usuario);
  if (!registroActual || registroActual.estatus !== 'ACTIVO') {
    invalidarSesionSegura_(token);
    throw new Error('Sesión inválida o expirada. Vuelve a iniciar sesión.');
  }

  const nombreActual = registroActual.nombre || sesion.nombre || '';
  const rolActual = registroActual.rol || sesion.rol || 'coordinador';
  const esAdminActual = !!registroActual.esAdmin;

  if (sesion.nombre !== nombreActual || sesion.rol !== rolActual || !!sesion.esAdmin !== esAdminActual) {
    const actualizada = {
      usuario: sesion.usuario,
      nombre: nombreActual,
      rol: rolActual,
      esAdmin: esAdminActual,
      creada: sesion.creada || new Date().toISOString()
    };
    CacheService.getScriptCache().put('nomina_session_' + token, JSON.stringify(actualizada), 21600);
    return actualizada;
  }

  return sesion;
}

function invalidarSesionSegura_(token) {
  if (token) {
    CacheService.getScriptCache().remove('nomina_session_' + token);
  }
  return { success: true };
}

function cerrarSesionServidor(token) {
  return invalidarSesionSegura_(token);
}

const HOJA_USUARIOS_ACCESO_ = 'Coord. Académicos';
const USUARIOS_ACCESO_HEADERS_ = ['Nombre', 'Observación', 'Usuario', 'Contraseña', 'Rol', 'Estatus', 'Fecha creación', 'Creado por', 'Fecha actualización', 'Actualizado por'];
const ROLES_USUARIOS_ACCESO_PERMITIDOS_ = {
  admin: true,
  coordinador: true,
  finanzas: true,
  contador: true,
  contabilidad: true
};

function asegurarHojaUsuariosAcceso_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_USUARIOS_ACCESO_);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA_USUARIOS_ACCESO_);
  }

  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, USUARIOS_ACCESO_HEADERS_.length).setValues([USUARIOS_ACCESO_HEADERS_]);
    return hoja;
  }

  if (hoja.getLastColumn() < USUARIOS_ACCESO_HEADERS_.length) {
    hoja.insertColumnsAfter(hoja.getLastColumn(), USUARIOS_ACCESO_HEADERS_.length - hoja.getLastColumn());
  }

  const encabezados = hoja.getRange(1, 1, 1, USUARIOS_ACCESO_HEADERS_.length).getValues()[0];
  let cambio = false;
  USUARIOS_ACCESO_HEADERS_.forEach(function(titulo, idx) {
    if (!encabezados[idx]) {
      encabezados[idx] = titulo;
      cambio = true;
    }
  });

  if (cambio) {
    hoja.getRange(1, 1, 1, USUARIOS_ACCESO_HEADERS_.length).setValues([encabezados]);
  }

  return hoja;
}

function normalizarRolUsuarioAcceso_(valor) {
  const rol = (valor || 'coordinador').toString().trim().toLowerCase();
  return ROLES_USUARIOS_ACCESO_PERMITIDOS_[rol] ? rol : 'coordinador';
}

function normalizarEstatusUsuarioAcceso_(valor) {
  return (valor || '').toString().trim().toUpperCase() === 'INACTIVO' ? 'INACTIVO' : 'ACTIVO';
}

function listarUsuariosAcceso_(libro) {
  const hoja = asegurarHojaUsuariosAcceso_(libro || SpreadsheetApp.getActiveSpreadsheet());
  if (hoja.getLastRow() < 2) return [];

  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, Math.max(hoja.getLastColumn(), USUARIOS_ACCESO_HEADERS_.length)).getValues();
  return datos
    .map(function(fila, idx) {
      return {
        filaHoja: idx + 2,
        nombre: (fila[0] || '').toString().trim(),
        observacion: (fila[1] || '').toString().trim(),
        usuario: (fila[2] || '').toString().trim(),
        pass: (fila[3] || '').toString().trim(),
        rol: normalizarRolUsuarioAcceso_(fila[4] || 'coordinador'),
        estatus: normalizarEstatusUsuarioAcceso_(fila[5] || 'ACTIVO'),
        fechaCreacion: (fila[6] || '').toString().trim(),
        creadoPor: (fila[7] || '').toString().trim(),
        fechaActualizacion: (fila[8] || '').toString().trim(),
        actualizadoPor: (fila[9] || '').toString().trim(),
        esAdmin: normalizarRolUsuarioAcceso_(fila[4] || 'coordinador') === 'admin'
      };
    })
    .filter(function(item) {
      return item.usuario || item.nombre;
    });
}

function obtenerResumenUsuariosAcceso_(usuarios) {
  const lista = usuarios || [];
  return {
    total: lista.length,
    activos: lista.filter(function(item) { return item.estatus === 'ACTIVO'; }).length,
    inactivos: lista.filter(function(item) { return item.estatus === 'INACTIVO'; }).length,
    admins: lista.filter(function(item) { return item.estatus === 'ACTIVO' && item.rol === 'admin'; }).length
  };
}

function validarAdminGestionAccesos_(sesion) {
  if (!sesion || !sesion.esAdmin) {
    throw new Error('Solo el administrador puede gestionar los accesos del sistema.');
  }
}

function prepararFilaUsuarioAcceso_(filaBase, payload, passwordFinal, sesion, conservarCreacion) {
  const fila = (filaBase || []).slice();
  while (fila.length < USUARIOS_ACCESO_HEADERS_.length) fila.push('');

  fila[0] = (payload.nombre || '').toString().trim();
  fila[1] = (payload.observacion || '').toString().trim();
  fila[2] = (payload.usuario || '').toString().trim();
  fila[3] = (passwordFinal || '').toString().trim();
  fila[4] = normalizarRolUsuarioAcceso_(payload.rol || 'coordinador');
  fila[5] = normalizarEstatusUsuarioAcceso_(payload.estatus || 'ACTIVO');

  const marcaTiempo = generarFechaHoraTexto_(new Date());
  if (!conservarCreacion || !fila[6]) fila[6] = marcaTiempo;
  if (!conservarCreacion || !fila[7]) fila[7] = (sesion.usuario || '').toString().trim();
  fila[8] = marcaTiempo;
  fila[9] = (sesion.usuario || '').toString().trim();

  return fila.slice(0, USUARIOS_ACCESO_HEADERS_.length);
}

function puedeQuitarAdmin_(usuarios, filaObjetivo) {
  return usuarios.filter(function(item) {
    return item.filaHoja !== filaObjetivo && item.estatus === 'ACTIVO' && item.rol === 'admin';
  }).length > 0;
}

function normalizarNombreClave_(valor) {
  return (valor || '')
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function obtenerFilaRealHorarios_(hojaHorarios, filaObjetivo) {
  if (!filaObjetivo) return null;
  const ultimaFila = hojaHorarios.getLastRow();
  if (filaObjetivo < 2 || filaObjetivo > ultimaFila) return null;
  return hojaHorarios.getRange(filaObjetivo, 1, 1, Math.max(hojaHorarios.getLastColumn(), 19)).getValues()[0];
}

function esFilaEditablePorSesion_(filaHoja, sesion) {
  if (!filaHoja) return false;
  if (sesion.esAdmin) return true;
  const coordinadorFila = (filaHoja[0] || '').toString().trim();
  return coordinadorFila === (sesion.nombre || '').toString().trim();
}

function responderErrorSeguridad_(e) {
  return { success: false, error: e && e.message ? e.message : e.toString() };
}


function obtenerHojaHorariosOperativa_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(HOJA_HORARIOS_OPERATIVA_);
}

function asegurarHojaHorariosDestino_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(HOJA_HORARIOS_DESTINO_);
  const hojaOperativa = obtenerHojaHorariosOperativa_(ss);
  let headers = HORARIOS_DOC_HEADERS_BASE_.slice();

  if (hojaOperativa && hojaOperativa.getLastColumn() > 0) {
    headers = hojaOperativa.getRange(1, 1, 1, Math.max(hojaOperativa.getLastColumn(), 19)).getValues()[0]
      .slice(0, Math.max(hojaOperativa.getLastColumn(), 19));
    while (headers.length < 19) headers.push(HORARIOS_DOC_HEADERS_BASE_[headers.length] || '');
  }

  if (!hoja) {
    hoja = ss.insertSheet(HOJA_HORARIOS_DESTINO_);
  }

  const ultimaCol = Math.max(hoja.getLastColumn(), headers.length || 19);
  if (hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const fila1 = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0];
    let actualizar = false;
    for (let i = 0; i < headers.length; i++) {
      if ((fila1[i] || '').toString().trim() !== headers[i]) {
        actualizar = true;
        break;
      }
    }
    if (actualizar) {
      hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  }

  hoja.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#FEF3C7');
  hoja.setFrozenRows(1);
  asegurarColumnasCicloHorarios_(hoja);
  return hoja;
}

function obtenerHojaHorariosPorOrigen_(libro, origen, crearDestinoSiNoExiste) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  const nombre = (origen || '').toString().trim();
  if (nombre === HOJA_HORARIOS_DESTINO_) {
    return crearDestinoSiNoExiste === false ? ss.getSheetByName(HOJA_HORARIOS_DESTINO_) : asegurarHojaHorariosDestino_(ss);
  }
  return obtenerHojaHorariosOperativa_(ss);
}

function normalizarVistaCicloHorarios_(vistaSolicitada, cfg) {
  const destinoActivo = !!(cfg && cfg.horariosDestinoHabilitado && cfg.horariosDestinoPeriodo && cfg.horariosDestinoCuatrimestre);
  const valorBruto = (vistaSolicitada || '').toString().trim().toUpperCase();

  if (!valorBruto) {
    return destinoActivo ? 'DESTINO' : 'OPERATIVO';
  }

  if (valorBruto === 'DESTINO' && destinoActivo) return 'DESTINO';
  return 'OPERATIVO';
}

function obtenerMetadatosVistaHorarios_(libro, vistaSolicitada) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  const cfg = obtenerConfiguracionCalendario_(ss);
  const cicloOperativo = obtenerPeriodoCuatrimestreOperativo_(cfg);
  const vistaActual = normalizarVistaCicloHorarios_(vistaSolicitada, cfg);
  const destinoActivo = !!(cfg.horariosDestinoHabilitado && cfg.horariosDestinoPeriodo && cfg.horariosDestinoCuatrimestre);

  return {
    cfg: cfg,
    vistaActual: vistaActual,
    destinoActivo: destinoActivo,
    hoja: vistaActual === 'DESTINO' ? asegurarHojaHorariosDestino_(ss) : obtenerHojaHorariosOperativa_(ss),
    hojaNombre: vistaActual === 'DESTINO' ? HOJA_HORARIOS_DESTINO_ : HOJA_HORARIOS_OPERATIVA_,
    periodo: vistaActual === 'DESTINO' ? (cfg.horariosDestinoPeriodo || '') : (cicloOperativo.periodo || ''),
    cuatrimestre: vistaActual === 'DESTINO' ? (cfg.horariosDestinoCuatrimestre || '') : (cicloOperativo.cuatrimestre || ''),
    periodoOperativo: cicloOperativo.periodo || '',
    cuatrimestreOperativo: cicloOperativo.cuatrimestre || '',
    periodoDestino: cfg.horariosDestinoPeriodo || '',
    cuatrimestreDestino: cfg.horariosDestinoCuatrimestre || ''
  };
}

function construirCargaYHorariosDesdeHoja_(hojaHorarios) {
  const horarios = [];
  const cargaPorDocente = {};

  if (!hojaHorarios || hojaHorarios.getLastRow() <= 1) {
    return { horarios: horarios, cargaPorDocente: cargaPorDocente };
  }

  asegurarColumnasCicloHorarios_(hojaHorarios);
  const datosH = hojaHorarios.getDataRange().getValues();

  for (let i = 1; i < datosH.length; i++) {
    const doc = datosH[i][2];
    if (!doc) continue;

    const l = parseFloat(datosH[i][6]) || 0;
    const m = parseFloat(datosH[i][7]) || 0;
    const x = parseFloat(datosH[i][8]) || 0;
    const j = parseFloat(datosH[i][9]) || 0;
    const v = parseFloat(datosH[i][10]) || 0;
    const s1 = parseFloat(datosH[i][11]) || 0;
    const s2 = parseFloat(datosH[i][12]) || 0;
    const horasBaseGuardadas = parseFloat(datosH[i][13]) || 0;

    const totalSemana = l + m + x + j + v;
    const totMod1 = totalSemana + s1;
    const totMod2 = totalSemana + s2;

    if (!cargaPorDocente[doc]) {
      cargaPorDocente[doc] = { semana: 0, s1: 0, s2: 0 };
    }

    cargaPorDocente[doc].semana += totalSemana;
    cargaPorDocente[doc].s1 += s1;
    cargaPorDocente[doc].s2 += s2;

    horarios.push({
      fila: i + 1,
      hojaOrigen: hojaHorarios.getName(),
      vistaCiclo: hojaHorarios.getName() === HOJA_HORARIOS_DESTINO_ ? 'DESTINO' : 'OPERATIVO',
      coordinador: datosH[i][0],
      asignatura: datosH[i][1],
      docente: doc,
      grupo: datosH[i][3],
      tabulador: datosH[i][4],
      tabDinero: datosH[i][5],
      l: datosH[i][6],
      m: datosH[i][7],
      x: datosH[i][8],
      j: datosH[i][9],
      v: datosH[i][10],
      s1: datosH[i][11],
      s2: datosH[i][12],
      horasBase: horasBaseGuardadas,
      totalSemana: totalSemana,
      totMod1: totMod1,
      totMod2: totMod2,
      faltas: datosH[i][14] || '',
      retardos: datosH[i][15] || '',
      extras: datosH[i][16] || '',
      periodo: (datosH[i][17] || '').toString().trim(),
      cuatrimestre: (datosH[i][18] || '').toString().trim()
    });
  }

  return { horarios: horarios, cargaPorDocente: cargaPorDocente };
}

function esEstatusActivo_(valor) {
  return ((valor || 'ACTIVO').toString().trim().toUpperCase() === 'ACTIVO');
}

function construirDocentesInfoDesdeCarga_(hojaDirectorio, cargaPorDocente) {
  if (!hojaDirectorio) return [];

  const mapa = asegurarColumnasDirectorio_(hojaDirectorio);
  return leerDirectorioCompleto_(hojaDirectorio, mapa)
    .filter(function(doc) {
      return esEstatusActivo_(doc.estatus);
    })
    .map(function(doc) {
      const nombre = doc.docente || '';
      const cat = (doc.categoria || 'N').toString().trim().toUpperCase();
      const max = (cat === 'V') ? 35 : ((cat === 'M') ? 25 : 15);
      const clave = normalizarNombreClave_(nombre);
      const carga = cargaPorDocente[clave] || cargaPorDocente[nombre] || { semana: 0, s1: 0, s2: 0 };
      const semana = parseFloat(carga.semana) || 0;
      const s1 = parseFloat(carga.s1) || 0;
      const s2 = parseFloat(carga.s2) || 0;

      return {
        nombre: nombre,
        categoria: cat,
        maxHoras: max,
        horasSemana: semana,
        horasMod1: semana + s1,
        horasMod2: semana + s2,
        estatus: (doc.estatus || 'ACTIVO').toString().trim().toUpperCase()
      };
    });
}

function desactivarCicloDestinoHorarios_(libro) {
  const hoja = obtenerHojaCalendario_(libro || SpreadsheetApp.getActiveSpreadsheet());
  hoja.getRange(CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_HABILITADO).setValue(false);
  hoja.getRange(CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_PERIODO).setValue('');
  hoja.getRange(CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_CUATRIMESTRE).setValue('');
}

function consolidarCicloDestinoAHorariosDocSiAplica_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  const hojaOperativa = obtenerHojaHorariosOperativa_(ss);
  const hojaDestino = ss.getSheetByName(HOJA_HORARIOS_DESTINO_);
  const cfg = obtenerConfiguracionCalendario_(ss);

  if (!hojaOperativa || !hojaDestino) {
    return { realizado: false, migrados: 0 };
  }

  if (hojaOperativa.getLastRow() > 1) {
    return { realizado: false, migrados: 0, motivo: 'Horarios Doc aún contiene registros del ciclo previo.' };
  }

  if (hojaDestino.getLastRow() <= 1) {
    if (cfg.horariosDestinoHabilitado) {
      desactivarCicloDestinoHorarios_(ss);
    }
    return { realizado: false, migrados: 0, motivo: 'No hay registros en Ciclo Destino.' };
  }

  const totalCols = Math.max(hojaOperativa.getLastColumn(), hojaDestino.getLastColumn(), 19);
  const datos = hojaDestino.getRange(2, 1, hojaDestino.getLastRow() - 1, totalCols).getValues()
    .filter(function(fila) {
      return fila.some(function(valor) { return valor !== '' && valor !== null; });
    });

  if (!datos.length) {
    hojaDestino.getRange(2, 1, hojaDestino.getLastRow() - 1, totalCols).clearContent();
    if (cfg.horariosDestinoHabilitado) {
      desactivarCicloDestinoHorarios_(ss);
    }
    return { realizado: false, migrados: 0, motivo: 'No hay datos útiles en Ciclo Destino.' };
  }

  hojaOperativa.getRange(2, 1, datos.length, totalCols).setValues(datos);
  hojaDestino.getRange(2, 1, hojaDestino.getLastRow() - 1, totalCols).clearContent();
  desactivarCicloDestinoHorarios_(ss);
  actualizarHojaHorasTotales(ss);

  return {
    realizado: true,
    migrados: datos.length,
    periodo: (cfg.horariosDestinoPeriodo || '').toString().trim(),
    cuatrimestre: (cfg.horariosDestinoCuatrimestre || '').toString().trim()
  };
}


function esUsuarioFinanzas_(sesion) {
  const rol = ((sesion && sesion.rol) || '').toString().trim().toLowerCase();
  return !!(sesion && sesion.esAdmin) || ['finanzas', 'contador', 'contabilidad', 'admin'].includes(rol);
}

function obtenerTimestampTexto_(valor) {
  const texto = (valor || '').toString().trim();
  if (!texto) return 0;

  const partes = texto.split(' ');
  const fecha = partes[0] || '';
  const hora = partes[1] || '00:00:00';
  const f = fecha.split('/');
  if (f.length !== 3) return 0;

  const dia = parseInt(f[0], 10);
  const mes = parseInt(f[1], 10) - 1;
  const anio = parseInt(f[2], 10);
  const h = hora.split(':');
  const hh = parseInt(h[0] || 0, 10);
  const mm = parseInt(h[1] || 0, 10);
  const ss = parseInt(h[2] || 0, 10);

  const fechaObj = new Date(anio, mes, dia, hh, mm, ss);
  return isNaN(fechaObj.getTime()) ? 0 : fechaObj.getTime();
}


const CALENDARIO_CFG_CELDAS_ = {
  QUINCENA_INICIO: 'K1',
  QUINCENA_FIN: 'K2',
  DIAS_ACCESO_INCIDENCIAS: 'K3',
  DIAS_ACCESO_EXTRAS: 'K4',
  MOD1_INICIO: 'K13',
  MOD1_FIN: 'K14',
  MOD2_INICIO: 'K15',
  MOD2_FIN: 'K16',
  HORARIOS_DESTINO_HABILITADO: 'K17',
  HORARIOS_DESTINO_PERIODO: 'K18',
  HORARIOS_DESTINO_CUATRIMESTRE: 'K19'
};


const HOJA_HORARIOS_OPERATIVA_ = 'Horarios Doc';
const HOJA_HORARIOS_DESTINO_ = 'Ciclo Destino';
const HORARIOS_DOC_HEADERS_BASE_ = [
  'COORDINADOR',
  'ASIGNATURA',
  'DOCENTE',
  'GRUPO',
  'TABULADOR',
  'MONTO TABULADOR',
  'L',
  'M',
  'X',
  'J',
  'V',
  'S1',
  'S2',
  'HORAS BASE',
  'FALTAS',
  'RETARDOS',
  'EXTRAS',
  'PERIODO',
  'CUATRIMESTRE'
];

const BITACORA_ELIMINADOS_HORARIOS_HOJA_ = 'Bitácora Eliminados Horarios';
const BITACORA_ELIMINADOS_HORARIOS_HEADERS_ = [
  'Fecha eliminación',
  'Usuario eliminación',
  'Rol eliminación',
  'Coordinador sesión',
  'Hoja origen',
  'Fila origen',
  'Coordinador registro',
  'Asignatura',
  'Docente',
  'Grupo',
  'Tabulador',
  'Monto tabulador',
  'L',
  'M',
  'X',
  'J',
  'V',
  'S1',
  'S2',
  'Horas base',
  'Faltas',
  'Retardos',
  'Extras',
  'Total semana',
  'Total Mod 1',
  'Total Mod 2'
];

function asegurarHojaBitacoraEliminadosHorarios_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(BITACORA_ELIMINADOS_HORARIOS_HOJA_);
  if (!hoja) {
    hoja = ss.insertSheet(BITACORA_ELIMINADOS_HORARIOS_HOJA_);
  }

  const ultimaColumnaNecesaria = BITACORA_ELIMINADOS_HORARIOS_HEADERS_.length;
  const encabezadosActuales = hoja.getRange(1, 1, 1, Math.max(hoja.getLastColumn(), ultimaColumnaNecesaria)).getValues()[0];
  let actualizarEncabezados = false;

  for (let i = 0; i < BITACORA_ELIMINADOS_HORARIOS_HEADERS_.length; i++) {
    if ((encabezadosActuales[i] || '').toString().trim() !== BITACORA_ELIMINADOS_HORARIOS_HEADERS_[i]) {
      actualizarEncabezados = true;
      break;
    }
  }

  if (actualizarEncabezados || hoja.getLastRow() === 0) {
    hoja.getRange(1, 1, 1, ultimaColumnaNecesaria).setValues([BITACORA_ELIMINADOS_HORARIOS_HEADERS_]);
    hoja.getRange(1, 1, 1, ultimaColumnaNecesaria)
      .setFontWeight('bold')
      .setBackground('#FEE2E2')
      .setFontColor('#7F1D1D');
    hoja.setFrozenRows(1);
  }

  return hoja;
}

function construirRegistroBitacoraEliminadoHorario_(filaActual, filaNumero, sesion) {
  const coordinadorRegistro = (filaActual[0] || '').toString().trim();
  const asignatura = (filaActual[1] || '').toString().trim();
  const docente = (filaActual[2] || '').toString().trim();
  const grupo = (filaActual[3] || '').toString().trim();
  const tabulador = (filaActual[4] || '').toString().trim();
  const montoTabulador = parseFloat(filaActual[5]) || 0;
  const l = parseFloat(filaActual[6]) || 0;
  const m = parseFloat(filaActual[7]) || 0;
  const x = parseFloat(filaActual[8]) || 0;
  const j = parseFloat(filaActual[9]) || 0;
  const v = parseFloat(filaActual[10]) || 0;
  const s1 = parseFloat(filaActual[11]) || 0;
  const s2 = parseFloat(filaActual[12]) || 0;
  const horasBase = parseFloat(filaActual[13]) || 0;
  const faltas = parseFloat(filaActual[14]) || 0;
  const retardos = parseFloat(filaActual[15]) || 0;
  const extras = parseFloat(filaActual[16]) || 0;
  const totalSemana = l + m + x + j + v;
  const totalMod1 = totalSemana + s1;
  const totalMod2 = totalSemana + s2;

  return [
    generarFechaHoraTexto_(new Date()),
    (sesion.usuario || '').toString().trim(),
    (sesion.rol || '').toString().trim(),
    (sesion.nombre || '').toString().trim(),
    'Horarios Doc',
    parseInt(filaNumero, 10) || '',
    coordinadorRegistro,
    asignatura,
    docente,
    grupo,
    tabulador,
    montoTabulador,
    l,
    m,
    x,
    j,
    v,
    s1,
    s2,
    horasBase,
    faltas,
    retardos,
    extras,
    totalSemana,
    totalMod1,
    totalMod2
  ];
}


const CIERRE_CUATRIMESTRE_BITACORA_HOJA_ = 'Bitácora Cierre Cuatrimestre';
const CIERRE_CUATRIMESTRE_HIST_HORARIOS_HOJA_ = 'Historico Horarios Doc';
const CIERRE_CUATRIMESTRE_HIST_EXTRAS_HOJA_ = 'Historico Extras';
const CIERRE_CUATRIMESTRE_BITACORA_HEADERS_ = [
  'Fecha ejecución',
  'Usuario',
  'Rol',
  'Acción',
  'Periodo',
  'Cuatrimestre',
  'Horarios archivados',
  'Extras archivados',
  'Docentes afectados',
  'Coordinaciones afectadas',
  'Observación'
];
const CIERRE_CUATRIMESTRE_HIST_HORARIOS_HEADERS_ = [
  'Fecha archivado',
  'Usuario archivado',
  'Rol archivado',
  'Acción',
  'Observación',
  'Fila origen',
  'Coordinador',
  'Asignatura',
  'Docente',
  'Grupo',
  'Tabulador',
  'Monto tabulador',
  'L',
  'M',
  'X',
  'J',
  'V',
  'S1',
  'S2',
  'Horas base',
  'Faltas',
  'Retardos',
  'Extras',
  'Periodo',
  'Cuatrimestre'
];
const CIERRE_CUATRIMESTRE_HIST_EXTRAS_HEADERS_ = [
  'Fecha archivado',
  'Usuario archivado',
  'Rol archivado',
  'Acción',
  'Observación',
  'Fila origen',
  'Fecha registro',
  'Coordinador',
  'Docente',
  'Horas',
  'Tabulador',
  'Motivo',
  'Fecha actividad',
  'Referencia',
  'Observaciones',
  'Capturado por',
  'Fecha actualización',
  'Actualizado por',
  'Periodo',
  'Cuatrimestre'
];

function asegurarHojaConEncabezados_(libro, nombre, headers, color) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  }
  const ultimaCol = Math.max(hoja.getLastColumn(), headers.length || 1);
  const fila1 = hoja.getRange(1, 1, 1, ultimaCol).getValues()[0];
  let actualizar = hoja.getLastRow() === 0;
  for (let i = 0; i < headers.length; i++) {
    if ((fila1[i] || '').toString().trim() !== headers[i]) {
      actualizar = true;
      break;
    }
  }
  if (actualizar) {
    hoja.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  hoja.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground(color || '#E5E7EB');
  hoja.setFrozenRows(1);
  return hoja;
}

function asegurarHojaBitacoraCierreCuatrimestre_(libro) {
  return asegurarHojaConEncabezados_(libro, CIERRE_CUATRIMESTRE_BITACORA_HOJA_, CIERRE_CUATRIMESTRE_BITACORA_HEADERS_, '#E2E8F0');
}

function asegurarHojaHistoricoHorarios_(libro) {
  return asegurarHojaConEncabezados_(libro, CIERRE_CUATRIMESTRE_HIST_HORARIOS_HOJA_, CIERRE_CUATRIMESTRE_HIST_HORARIOS_HEADERS_, '#DBEAFE');
}

function asegurarHojaHistoricoExtras_(libro) {
  return asegurarHojaConEncabezados_(libro, CIERRE_CUATRIMESTRE_HIST_EXTRAS_HOJA_, CIERRE_CUATRIMESTRE_HIST_EXTRAS_HEADERS_, '#D1FAE5');
}

function normalizarAccionCierreCuatrimestre_(accion) {
  const valor = (accion || 'COMPLETO').toString().trim().toUpperCase();
  return ['HORARIOS', 'EXTRAS', 'COMPLETO'].includes(valor) ? valor : 'COMPLETO';
}

function normalizarValorCierreCuatrimestre_(valor) {
  return (valor || '')
    .toString()
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizarPeriodoCierreCuatrimestre_(valor) {
  return normalizarValorCierreCuatrimestre_(valor)
    .replace(/\s*AL\s*/g, ' AL ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .trim();
}

function normalizarCuatrimestreCierreCuatrimestre_(valor) {
  return normalizarValorCierreCuatrimestre_(valor).replace(/\s*\-\s*/g, '-');
}

function obtenerFiltroCierreCuatrimestre_(datos, cfg) {
  const ciclo = obtenerPeriodoCuatrimestreOperativo_(cfg || {});
  const periodoCapturado = ((datos && datos.periodo) || ciclo.periodo || '').toString();
  const cuatrimestreCapturado = ((datos && datos.cuatrimestre) || ciclo.cuatrimestre || '').toString();
  const periodo = normalizarPeriodoCierreCuatrimestre_(periodoCapturado);
  const cuatrimestre = normalizarCuatrimestreCierreCuatrimestre_(cuatrimestreCapturado);
  return {
    periodo: periodo,
    cuatrimestre: cuatrimestre,
    periodoOriginal: normalizarTextoLibre_(periodoCapturado, 120),
    cuatrimestreOriginal: normalizarTextoLibre_(cuatrimestreCapturado, 30),
    valido: !!(periodo && cuatrimestre),
    cicloActual: {
      periodo: normalizarTextoLibre_((ciclo && ciclo.periodo) || '', 120),
      cuatrimestre: normalizarTextoLibre_((ciclo && ciclo.cuatrimestre) || '', 30),
      valido: !!ciclo.valido
    }
  };
}

function normalizarEncabezadoCierreCuatrimestre_(valor) {
  return normalizarValorCierreCuatrimestre_(valor).replace(/[^A-Z0-9]/g, '');
}

function obtenerIndiceEncabezadoCierreCuatrimestre_(headers, aliases, fallbackIndex) {
  const normalizados = (headers || []).map(normalizarEncabezadoCierreCuatrimestre_);
  const aliasNorm = (aliases || []).map(normalizarEncabezadoCierreCuatrimestre_);
  for (let i = 0; i < normalizados.length; i++) {
    if (aliasNorm.indexOf(normalizados[i]) !== -1) return i;
  }
  return fallbackIndex;
}

function obtenerMapaColumnasHorariosCierreCuatrimestre_(hojaHorarios) {
  const totalCols = Math.max((hojaHorarios && hojaHorarios.getLastColumn()) || 0, 19);
  const headers = hojaHorarios ? hojaHorarios.getRange(1, 1, 1, totalCols).getDisplayValues()[0] : [];
  return {
    headers: headers,
    coordinador: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['COORDINADOR', 'COORDINACION', 'COORDINADOR(A)'], 0),
    asignatura: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['ASIGNATURA', 'MATERIA'], 1),
    docente: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['DOCENTE', 'PROFESOR'], 2),
    grupo: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['GRUPO'], 3),
    tabulador: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['TABULADOR'], 4),
    montoTabulador: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['MONTO TABULADOR', 'MONTO', 'TABULADOR $'], 5),
    horasBase: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['HORAS BASE', 'HORASBASE', 'HORAS BASE QNA', 'HORAS BASE QUINCENA'], 13),
    faltas: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['FALTAS'], 14),
    retardos: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['RETARDOS'], 15),
    extras: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['EXTRAS'], 16),
    periodo: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['PERIODO', 'PERÍODO', 'PERIODO QUINCENAL'], 17),
    cuatrimestre: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['CUATRIMESTRE'], 18)
  };
}

function obtenerMapaColumnasExtrasCierreCuatrimestre_(hojaExtras) {
  const totalCols = Math.max((hojaExtras && hojaExtras.getLastColumn()) || 0, 14);
  const headers = hojaExtras ? hojaExtras.getRange(1, 1, 1, totalCols).getDisplayValues()[0] : [];
  return {
    headers: headers,
    fechaRegistro: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['FECHA REGISTRO', 'FECHA'], 0),
    coordinador: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['COORDINADOR', 'COORDINACION'], 1),
    docente: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['DOCENTE', 'PROFESOR'], 2),
    horas: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['HORAS', 'HORAS EXTRA', 'HORA EXTRA'], 3),
    tabulador: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['TABULADOR', 'TABULADOR EXTRA'], 4),
    motivo: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['MOTIVO', 'ACTIVIDAD'], 5),
    fechaActividad: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['FECHA ACTIVIDAD'], 6),
    referencia: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['REFERENCIA'], 7),
    observaciones: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['OBSERVACIONES'], 8),
    capturadoPor: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['CAPTURADO POR', 'USUARIO CAPTURA'], 9),
    fechaActualizacion: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['FECHA ACTUALIZACION', 'FECHA ACTUALIZACIÓN'], 10),
    actualizadoPor: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['ACTUALIZADO POR'], 11),
    periodo: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['PERIODO', 'PERÍODO', 'PERIODO QUINCENAL'], 12),
    cuatrimestre: obtenerIndiceEncabezadoCierreCuatrimestre_(headers, ['CUATRIMESTRE'], 13)
  };
}

function obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, indice) {
  const visible = serializarValorDiagnosticoCierreCuatrimestre_(filaVisible && indice >= 0 ? filaVisible[indice] : '');
  if (visible) return visible;
  return serializarValorDiagnosticoCierreCuatrimestre_(fila && indice >= 0 ? fila[indice] : '');
}

function leerCoincidenciasHorariosPorCiclo_(hojaHorarios, periodo, cuatrimestre) {
  if (!hojaHorarios || hojaHorarios.getLastRow() <= 1) return [];
  asegurarColumnasCicloHorarios_(hojaHorarios);
  const mapa = obtenerMapaColumnasHorariosCierreCuatrimestre_(hojaHorarios);
  const total = hojaHorarios.getLastRow() - 1;
  const totalCols = Math.max(hojaHorarios.getLastColumn(), mapa.cuatrimestre + 1, 19);
  const rango = hojaHorarios.getRange(2, 1, total, totalCols);
  const datos = rango.getValues();
  const visibles = rango.getDisplayValues();
  const periodoBuscado = normalizarPeriodoCierreCuatrimestre_(periodo);
  const cuatrimestreBuscado = normalizarCuatrimestreCierreCuatrimestre_(cuatrimestre);
  const registros = [];
  datos.forEach(function(fila, idx) {
    const filaVisible = visibles[idx] || [];
    const periodoFila = normalizarPeriodoCierreCuatrimestre_(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.periodo));
    const cuatrimestreFila = normalizarCuatrimestreCierreCuatrimestre_(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.cuatrimestre));
    const docente = obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.docente).trim();
    if (!docente) return;
    if (periodoFila !== periodoBuscado || cuatrimestreFila !== cuatrimestreBuscado) return;
    registros.push({
      filaHoja: idx + 2,
      valores: fila,
      visibles: filaVisible,
      campos: {
        docente: docente,
        coordinador: obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.coordinador).trim(),
        asignatura: obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.asignatura).trim(),
        grupo: obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.grupo).trim(),
        montoTabulador: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.montoTabulador)) || 0,
        horasBase: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.horasBase)) || 0,
        faltas: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.faltas)) || 0,
        retardos: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.retardos)) || 0,
        extras: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.extras)) || 0,
        periodo: periodoFila,
        cuatrimestre: cuatrimestreFila
      }
    });
  });
  return registros;
}

function leerCoincidenciasExtrasPorCiclo_(hojaExtras, periodo, cuatrimestre) {
  if (!hojaExtras || hojaExtras.getLastRow() <= 1) return [];
  asegurarColumnasCicloExtras_(hojaExtras);
  const mapa = obtenerMapaColumnasExtrasCierreCuatrimestre_(hojaExtras);
  const total = hojaExtras.getLastRow() - 1;
  const totalCols = Math.max(hojaExtras.getLastColumn(), mapa.cuatrimestre + 1, 14);
  const rango = hojaExtras.getRange(2, 1, total, totalCols);
  const datos = rango.getValues();
  const visibles = rango.getDisplayValues();
  const periodoBuscado = normalizarPeriodoCierreCuatrimestre_(periodo);
  const cuatrimestreBuscado = normalizarCuatrimestreCierreCuatrimestre_(cuatrimestre);
  const registros = [];
  datos.forEach(function(fila, idx) {
    const filaVisible = visibles[idx] || [];
    const periodoFila = normalizarPeriodoCierreCuatrimestre_(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.periodo));
    const cuatrimestreFila = normalizarCuatrimestreCierreCuatrimestre_(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.cuatrimestre));
    const docente = obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.docente).trim();
    if (!docente) return;
    if (periodoFila !== periodoBuscado || cuatrimestreFila !== cuatrimestreBuscado) return;
    registros.push({
      filaHoja: idx + 2,
      valores: fila,
      visibles: filaVisible,
      campos: {
        docente: docente,
        coordinador: obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.coordinador).trim(),
        horas: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.horas)) || 0,
        tabulador: parseFloat(obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.tabulador)) || 0,
        motivo: obtenerValorCeldaCierreCuatrimestre_(fila, filaVisible, mapa.motivo).trim(),
        periodo: periodoFila,
        cuatrimestre: cuatrimestreFila
      }
    });
  });
  return registros;
}

function construirPreviewCierreCuatrimestre_(libro, filtro) {
  const hojaHorarios = libro.getSheetByName('Horarios Doc');
  const hojaExtras = libro.getSheetByName('Extras');
  const horarios = leerCoincidenciasHorariosPorCiclo_(hojaHorarios, filtro.periodo, filtro.cuatrimestre);
  const extras = leerCoincidenciasExtrasPorCiclo_(hojaExtras, filtro.periodo, filtro.cuatrimestre);
  const docentes = {};
  const coordinaciones = {};
  const resumen = {
    periodo: filtro.periodo,
    cuatrimestre: filtro.cuatrimestre,
    horarios: { total: 0, docentes: 0, coordinaciones: 0, horasBase: 0 },
    extras: { total: 0, docentes: 0, coordinaciones: 0, horas: 0, monto: 0 },
    consolidado: { docentes: 0, coordinaciones: 0, registros: 0 },
    hayCoincidencias: false
  };

  horarios.forEach(function(item) {
    const campos = item.campos || {};
    if (campos.docente) docentes[normalizarNombreClave_(campos.docente)] = true;
    if (campos.coordinador) coordinaciones[campos.coordinador] = true;
    resumen.horarios.total++;
    resumen.horarios.horasBase += parseFloat(campos.horasBase) || 0;
  });

  extras.forEach(function(item) {
    const campos = item.campos || {};
    if (campos.docente) docentes[normalizarNombreClave_(campos.docente)] = true;
    if (campos.coordinador) coordinaciones[campos.coordinador] = true;
    resumen.extras.total++;
    resumen.extras.horas += parseFloat(campos.horas) || 0;
    resumen.extras.monto += (parseFloat(campos.horas) || 0) * (parseFloat(campos.tabulador) || 0);
  });

  resumen.consolidado.docentes = Object.keys(docentes).length;
  resumen.consolidado.coordinaciones = Object.keys(coordinaciones).length;
  resumen.consolidado.registros = resumen.horarios.total + resumen.extras.total;
  resumen.horarios.docentes = resumen.consolidado.docentes;
  resumen.horarios.coordinaciones = resumen.consolidado.coordinaciones;
  resumen.extras.docentes = resumen.consolidado.docentes;
  resumen.extras.coordinaciones = resumen.consolidado.coordinaciones;
  resumen.hayCoincidencias = resumen.consolidado.registros > 0;
  return resumen;
}

function convertirIndiceALetraCierreCuatrimestre_(indiceCeroBase) {
  if (indiceCeroBase == null || indiceCeroBase < 0) return '';
  var num = indiceCeroBase + 1;
  var letra = '';
  while (num > 0) {
    var mod = (num - 1) % 26;
    letra = String.fromCharCode(65 + mod) + letra;
    num = Math.floor((num - mod) / 26);
  }
  return letra;
}

function serializarValorDiagnosticoCierreCuatrimestre_(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return Utilities.formatDate(valor, obtenerTimezone_(), 'dd/MM/yyyy HH:mm:ss');
  }
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

function construirResumenColumnaDiagnosticoCierreCuatrimestre_(headers, indice) {
  return {
    indice: indice + 1,
    letra: convertirIndiceALetraCierreCuatrimestre_(indice),
    header: (headers[indice] || '').toString().trim()
  };
}

function construirDiagnosticoHojaCierreCuatrimestre_(hoja, tipo, periodo, cuatrimestre) {
  var titulo = tipo === 'horarios' ? 'Horarios Doc' : 'Extras';
  if (!hoja) {
    return {
      tipo: tipo,
      titulo: titulo,
      sheetName: '',
      lastRow: 0,
      lastColumn: 0,
      columnas: {
        periodo: { indice: 0, letra: '', header: '' },
        cuatrimestre: { indice: 0, letra: '', header: '' }
      },
      valoresUnicosPeriodo: [],
      valoresUnicosCuatrimestre: [],
      muestras: []
    };
  }

  var mapa = tipo === 'horarios'
    ? obtenerMapaColumnasHorariosCierreCuatrimestre_(hoja)
    : obtenerMapaColumnasExtrasCierreCuatrimestre_(hoja);
  var lastRow = hoja.getLastRow();
  var lastColumn = hoja.getLastColumn();
  var totalCols = Math.max(lastColumn, (mapa.cuatrimestre || 0) + 1, tipo === 'horarios' ? 19 : 14);
  var totalRows = Math.max(lastRow - 1, 0);
  var datos = totalRows ? hoja.getRange(2, 1, totalRows, totalCols).getValues() : [];
  var visibles = totalRows ? hoja.getRange(2, 1, totalRows, totalCols).getDisplayValues() : [];
  var buscadoPeriodo = normalizarPeriodoCierreCuatrimestre_(periodo);
  var buscadoCuatrimestre = normalizarCuatrimestreCierreCuatrimestre_(cuatrimestre);
  var unicosPeriodo = {};
  var unicosCuatrimestre = {};
  var muestras = [];
  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i] || [];
    var filaVisible = visibles[i] || [];
    var periodoRaw = serializarValorDiagnosticoCierreCuatrimestre_(fila[mapa.periodo]);
    var cuatriRaw = serializarValorDiagnosticoCierreCuatrimestre_(fila[mapa.cuatrimestre]);
    var periodoDisplay = serializarValorDiagnosticoCierreCuatrimestre_(filaVisible[mapa.periodo]);
    var cuatriDisplay = serializarValorDiagnosticoCierreCuatrimestre_(filaVisible[mapa.cuatrimestre]);
    var periodoNorm = normalizarPeriodoCierreCuatrimestre_(periodoDisplay || periodoRaw || '');
    var cuatriNorm = normalizarCuatrimestreCierreCuatrimestre_(cuatriDisplay || cuatriRaw || '');
    if (periodoNorm) unicosPeriodo[periodoNorm] = true;
    if (cuatriNorm) unicosCuatrimestre[cuatriNorm] = true;
    if (muestras.length < 12) {
      var idxDocente = mapa.docente;
      muestras.push({
        filaHoja: i + 2,
        docente: serializarValorDiagnosticoCierreCuatrimestre_(filaVisible[idxDocente] || fila[idxDocente] || ''),
        periodoRaw: periodoRaw,
        periodoDisplay: periodoDisplay,
        periodoNormalizado: periodoNorm,
        cuatrimestreRaw: cuatriRaw,
        cuatrimestreDisplay: cuatriDisplay,
        cuatrimestreNormalizado: cuatriNorm,
        coincide: !!(periodoNorm && cuatriNorm && periodoNorm === buscadoPeriodo && cuatriNorm === buscadoCuatrimestre)
      });
    }
  }

  return {
    tipo: tipo,
    titulo: titulo,
    sheetName: hoja.getName(),
    lastRow: lastRow,
    lastColumn: lastColumn,
    target: {
      periodo: buscadoPeriodo,
      cuatrimestre: buscadoCuatrimestre
    },
    columnas: {
      periodo: construirResumenColumnaDiagnosticoCierreCuatrimestre_(mapa.headers || [], mapa.periodo),
      cuatrimestre: construirResumenColumnaDiagnosticoCierreCuatrimestre_(mapa.headers || [], mapa.cuatrimestre)
    },
    headers: mapa.headers || [],
    valoresUnicosPeriodo: Object.keys(unicosPeriodo).slice(0, 20),
    valoresUnicosCuatrimestre: Object.keys(unicosCuatrimestre).slice(0, 20),
    muestras: muestras
  };
}

function obtenerDiagnosticoCierreCuatrimestre(token, datos) {
  try {
    var sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede consultar el diagnóstico.' };
    }
    var libro = SpreadsheetApp.getActiveSpreadsheet();
    var filtro = obtenerFiltroCierreCuatrimestre_(datos, obtenerConfiguracionCalendario_(libro));
    return {
      success: true,
      diagnostico: {
        filtro: {
          periodo: filtro.periodo,
          cuatrimestre: filtro.cuatrimestre
        },
        horarios: construirDiagnosticoHojaCierreCuatrimestre_(libro.getSheetByName('Horarios Doc'), 'horarios', filtro.periodo, filtro.cuatrimestre),
        extras: construirDiagnosticoHojaCierreCuatrimestre_(libro.getSheetByName('Extras'), 'extras', filtro.periodo, filtro.cuatrimestre)
      }
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function leerBitacoraCierreCuatrimestre_(libro) {
  const hoja = asegurarHojaBitacoraCierreCuatrimestre_(libro);
  if (hoja.getLastRow() <= 1) return [];
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, CIERRE_CUATRIMESTRE_BITACORA_HEADERS_.length).getValues();
  return datos.map(function(fila, idx) {
    return {
      filaHoja: idx + 2,
      fechaEjecucion: (fila[0] || '').toString().trim(),
      usuario: (fila[1] || '').toString().trim(),
      rol: (fila[2] || '').toString().trim(),
      accion: (fila[3] || '').toString().trim(),
      periodo: (fila[4] || '').toString().trim(),
      cuatrimestre: (fila[5] || '').toString().trim(),
      horariosArchivados: parseInt(fila[6], 10) || 0,
      extrasArchivados: parseInt(fila[7], 10) || 0,
      docentesAfectados: parseInt(fila[8], 10) || 0,
      coordinacionesAfectadas: parseInt(fila[9], 10) || 0,
      observacion: (fila[10] || '').toString().trim()
    };
  }).reverse();
}

function construirFilaHistoricoHorario_(registro, sesion, accion, observacion) {
  const fila = (registro && registro.valores) || [];
  return [
    generarFechaHoraTexto_(new Date()),
    (sesion.usuario || '').toString().trim(),
    (sesion.rol || '').toString().trim(),
    accion,
    observacion || '',
    registro.filaHoja || '',
    (fila[0] || '').toString().trim(),
    (fila[1] || '').toString().trim(),
    (fila[2] || '').toString().trim(),
    (fila[3] || '').toString().trim(),
    (fila[4] || '').toString().trim(),
    parseFloat(fila[5]) || 0,
    parseFloat(fila[6]) || 0,
    parseFloat(fila[7]) || 0,
    parseFloat(fila[8]) || 0,
    parseFloat(fila[9]) || 0,
    parseFloat(fila[10]) || 0,
    parseFloat(fila[11]) || 0,
    parseFloat(fila[12]) || 0,
    parseFloat(fila[13]) || 0,
    parseFloat(fila[14]) || 0,
    parseFloat(fila[15]) || 0,
    parseFloat(fila[16]) || 0,
    (fila[17] || '').toString().trim(),
    (fila[18] || '').toString().trim()
  ];
}

function construirFilaHistoricoExtra_(registro, sesion, accion, observacion) {
  const fila = (registro && registro.valores) || [];
  return [
    generarFechaHoraTexto_(new Date()),
    (sesion.usuario || '').toString().trim(),
    (sesion.rol || '').toString().trim(),
    accion,
    observacion || '',
    registro.filaHoja || '',
    (fila[0] || '').toString().trim(),
    (fila[1] || '').toString().trim(),
    (fila[2] || '').toString().trim(),
    parseFloat(fila[3]) || 0,
    parseFloat(fila[4]) || 0,
    (fila[5] || '').toString().trim(),
    (fila[6] || '').toString().trim(),
    (fila[7] || '').toString().trim(),
    (fila[8] || '').toString().trim(),
    (fila[9] || '').toString().trim(),
    (fila[10] || '').toString().trim(),
    (fila[11] || '').toString().trim(),
    (fila[12] || '').toString().trim(),
    (fila[13] || '').toString().trim()
  ];
}

function obtenerPanelCierreCuatrimestre(token) {
  try {
    const sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede acceder a este módulo.' };
    }
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const cfg = obtenerConfiguracionCalendario_(libro);
    const filtro = obtenerFiltroCierreCuatrimestre_(null, cfg);
    return {
      success: true,
      rol: sesion.rol || '',
      cicloActual: filtro.cicloActual,
      preview: filtro.valido ? construirPreviewCierreCuatrimestre_(libro, filtro) : construirPreviewCierreCuatrimestre_(libro, { periodo: '', cuatrimestre: '' }),
      bitacora: leerBitacoraCierreCuatrimestre_(libro)
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function obtenerResumenCierreCuatrimestre(token, datos) {
  try {
    const sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede consultar esta vista previa.' };
    }
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const filtro = obtenerFiltroCierreCuatrimestre_(datos, obtenerConfiguracionCalendario_(libro));
    if (!filtro.valido) {
      return { success: false, error: 'Indica un periodo y un cuatrimestre válidos para consultar la vista previa.' };
    }
    return {
      success: true,
      cicloActual: filtro.cicloActual,
      preview: construirPreviewCierreCuatrimestre_(libro, filtro)
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function ejecutarCierreCuatrimestre(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede ejecutar el cierre de cuatrimestre.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const filtro = obtenerFiltroCierreCuatrimestre_(datos, obtenerConfiguracionCalendario_(libro));
    if (!filtro.valido) {
      return { success: false, error: 'Indica un periodo y un cuatrimestre válidos para ejecutar el cierre.' };
    }

    const accion = normalizarAccionCierreCuatrimestre_(datos && datos.accion);
    const observacion = normalizarTextoLibre_((datos && datos.observacion) || '', 250);
    const hojaHorarios = libro.getSheetByName('Horarios Doc');
    const hojaExtras = libro.getSheetByName('Extras');
    const coincidenciasHorarios = leerCoincidenciasHorariosPorCiclo_(hojaHorarios, filtro.periodo, filtro.cuatrimestre);
    const coincidenciasExtras = leerCoincidenciasExtrasPorCiclo_(hojaExtras, filtro.periodo, filtro.cuatrimestre);

    if (accion === 'HORARIOS' && !coincidenciasHorarios.length) {
      return { success: false, error: 'No hay registros de Horarios Doc para el ciclo seleccionado.' };
    }
    if (accion === 'EXTRAS' && !coincidenciasExtras.length) {
      return { success: false, error: 'No hay registros de Extras para el ciclo seleccionado.' };
    }
    if (accion === 'COMPLETO' && !coincidenciasHorarios.length && !coincidenciasExtras.length) {
      return { success: false, error: 'No hay registros de Horarios ni Extras para el ciclo seleccionado.' };
    }

    const hojaHistHorarios = asegurarHojaHistoricoHorarios_(libro);
    const hojaHistExtras = asegurarHojaHistoricoExtras_(libro);
    const hojaBitacora = asegurarHojaBitacoraCierreCuatrimestre_(libro);
    const docentes = {};
    const coordinaciones = {};
    let horariosArchivados = 0;
    let extrasArchivados = 0;

    if ((accion === 'HORARIOS' || accion === 'COMPLETO') && coincidenciasHorarios.length) {
      const filasHistorico = coincidenciasHorarios.map(function(reg) {
        const fila = reg.valores || [];
        const docente = (fila[2] || '').toString().trim();
        const coordinador = (fila[0] || '').toString().trim();
        if (docente) docentes[normalizarNombreClave_(docente)] = true;
        if (coordinador) coordinaciones[coordinador] = true;
        return construirFilaHistoricoHorario_(reg, sesion, accion, observacion);
      });
      hojaHistHorarios.getRange(hojaHistHorarios.getLastRow() + 1, 1, filasHistorico.length, CIERRE_CUATRIMESTRE_HIST_HORARIOS_HEADERS_.length).setValues(filasHistorico);
      coincidenciasHorarios.slice().sort(function(a, b) { return b.filaHoja - a.filaHoja; }).forEach(function(reg) {
        hojaHorarios.deleteRow(reg.filaHoja);
      });
      horariosArchivados = coincidenciasHorarios.length;
    }

    if ((accion === 'EXTRAS' || accion === 'COMPLETO') && coincidenciasExtras.length) {
      const filasHistorico = coincidenciasExtras.map(function(reg) {
        const fila = reg.valores || [];
        const docente = (fila[2] || '').toString().trim();
        const coordinador = (fila[1] || '').toString().trim();
        if (docente) docentes[normalizarNombreClave_(docente)] = true;
        if (coordinador) coordinaciones[coordinador] = true;
        return construirFilaHistoricoExtra_(reg, sesion, accion, observacion);
      });
      hojaHistExtras.getRange(hojaHistExtras.getLastRow() + 1, 1, filasHistorico.length, CIERRE_CUATRIMESTRE_HIST_EXTRAS_HEADERS_.length).setValues(filasHistorico);
      coincidenciasExtras.slice().sort(function(a, b) { return b.filaHoja - a.filaHoja; }).forEach(function(reg) {
        hojaExtras.deleteRow(reg.filaHoja);
      });
      extrasArchivados = coincidenciasExtras.length;
    }

    let consolidacionDestino = { realizado: false, migrados: 0 };
    if (accion === 'HORARIOS' || accion === 'COMPLETO') {
      consolidacionDestino = consolidarCicloDestinoAHorariosDocSiAplica_(libro);
    } else if (horariosArchivados > 0) {
      actualizarHojaHorasTotales(libro);
    }

    hojaBitacora.appendRow([
      generarFechaHoraTexto_(new Date()),
      (sesion.usuario || '').toString().trim(),
      (sesion.rol || '').toString().trim(),
      accion,
      filtro.periodo,
      filtro.cuatrimestre,
      horariosArchivados,
      extrasArchivados,
      Object.keys(docentes).length,
      Object.keys(coordinaciones).length,
      observacion
    ]);

    return {
      success: true,
      message: consolidacionDestino.realizado
        ? 'Cierre cuatrimestral ejecutado correctamente y se consolidó el siguiente ciclo en Horarios Doc.'
        : 'Cierre cuatrimestral ejecutado correctamente.',
      resultado: {
        accion: accion,
        periodo: filtro.periodo,
        cuatrimestre: filtro.cuatrimestre,
        horariosArchivados: horariosArchivados,
        extrasArchivados: extrasArchivados,
        docentesAfectados: Object.keys(docentes).length,
        coordinacionesAfectadas: Object.keys(coordinaciones).length,
        siguienteCicloMigrado: !!consolidacionDestino.realizado,
        registrosMigradosDesdeDestino: consolidacionDestino.migrados || 0
      },
      preview: construirPreviewCierreCuatrimestre_(libro, filtro),
      bitacora: leerBitacoraCierreCuatrimestre_(libro)
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


function obtenerHojaCalendario_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName('Calendario');
  if (!hoja) {
    hoja = ss.insertSheet('Calendario');
  }
  return hoja;
}

function parseFechaIsoConfiguracion_(texto) {
  const valor = (texto || '').toString().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const fecha = new Date(valor + 'T12:00:00');
  return isNaN(fecha.getTime()) ? null : fecha;
}

function leerFechaConfiguracion_(hoja, a1) {
  const valor = hoja.getRange(a1).getValue();
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate(), 12, 0, 0, 0);
  }
  return parseFechaIsoConfiguracion_(valor);
}

function leerNumeroConfiguracion_(hoja, a1, predeterminado) {
  const valor = hoja.getRange(a1).getValue();
  const numero = parseInt(valor, 10);
  return isNaN(numero) ? predeterminado : numero;
}

function leerTextoConfiguracion_(hoja, a1) {
  return (hoja.getRange(a1).getDisplayValue() || hoja.getRange(a1).getValue() || '').toString().trim();
}

function leerBooleanConfiguracion_(hoja, a1) {
  const valor = hoja.getRange(a1).getValue();
  if (valor === true || valor === false) return valor;
  const texto = (valor || '').toString().trim().toLowerCase();
  return texto === 'true' || texto === '1' || texto === 'si' || texto === 'sí' || texto === 'x';
}

function leerDiasInhabilesConfiguracion_(hoja) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];
  return hoja.getRange(2, 14, ultimaFila - 1, 1).getValues()
    .flat()
    .filter(function(valor) { return valor instanceof Date && !isNaN(valor.getTime()); })
    .map(function(fecha) { return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0); });
}

function serializarFechasConfiguracion_(fechas, tz) {
  return (fechas || []).map(function(fecha) {
    return formatearFechaIsoConfiguracion_(fecha, tz);
  }).filter(Boolean);
}

function parseListaFechasIsoConfiguracion_(lista) {
  if (!Array.isArray(lista)) return [];
  const mapa = {};
  const resultado = [];
  lista.forEach(function(item) {
    const fecha = parseFechaIsoConfiguracion_(item);
    if (!fecha) return;
    const iso = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (mapa[iso]) return;
    mapa[iso] = true;
    resultado.push(fecha);
  });
  resultado.sort(function(a, b) { return a.getTime() - b.getTime(); });
  return resultado;
}

function guardarDiasInhabilesConfiguracion_(hoja, fechas) {
  const ultimaFila = Math.max(hoja.getLastRow(), 2);
  hoja.getRange(2, 14, ultimaFila - 1, 1).clearContent();

  if (!fechas || !fechas.length) return;

  const valores = fechas.map(function(fecha) { return [fecha]; });
  hoja.getRange(2, 14, valores.length, 1).setValues(valores).setNumberFormat('dd/mm/yyyy');
}

function normalizarFechaInicio_(fecha) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return null;
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
}

function normalizarFechaFin_(fecha) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return null;
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

function sumarDiasFecha_(fecha, dias) {
  const base = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0);
  base.setDate(base.getDate() + dias);
  return base;
}

function formatearFechaIsoConfiguracion_(fecha, tz) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '';
  const fechaSegura = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0);
  return Utilities.formatDate(fechaSegura, tz || obtenerTimezone_(), 'yyyy-MM-dd');
}

function formatearFechaHumanaConfiguracion_(fecha, tz) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '—';
  const fechaSegura = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0);
  return Utilities.formatDate(fechaSegura, tz || obtenerTimezone_(), 'dd/MM/yyyy');
}

function construirVentanaCaptura_(inicioQuincena, finQuincena, diasConfigurados, tz, etiquetaModulo) {
  const dias = Math.max(0, parseInt(diasConfigurados, 10) || 0);

  if (!(inicioQuincena instanceof Date) || isNaN(inicioQuincena.getTime()) ||
      !(finQuincena instanceof Date) || isNaN(finQuincena.getTime())) {
    return {
      abierta: false,
      inicio: '',
      fin: '',
      diasConfigurados: dias,
      etiquetaVentana: '',
      mensaje: 'Configura primero el inicio y fin de la quincena para habilitar ' + etiquetaModulo + '.'
    };
  }

  const inicio = normalizarFechaInicio_(inicioQuincena);
  const finQuincenaNormalizada = normalizarFechaFin_(finQuincena);

  if (dias === 0) {
    return {
      abierta: false,
      inicio: formatearFechaIsoConfiguracion_(inicio, tz),
      fin: formatearFechaIsoConfiguracion_(inicio, tz),
      diasConfigurados: dias,
      etiquetaVentana: 'Cerrada manualmente',
      mensaje: 'El acceso a ' + etiquetaModulo + ' está cerrado porque se configuraron 0 días de captura.'
    };
  }

  let fin = normalizarFechaFin_(sumarDiasFecha_(inicio, dias - 1));
  if (fin > finQuincenaNormalizada) {
    fin = finQuincenaNormalizada;
  }

  const ahora = new Date();
  const abierta = ahora >= inicio && ahora <= fin;
  const inicioTxt = formatearFechaHumanaConfiguracion_(inicio, tz);
  const finTxt = formatearFechaHumanaConfiguracion_(fin, tz);

  let mensaje = 'Ventana cerrada.';
  if (abierta) {
    mensaje = etiquetaModulo + ' abierto del ' + inicioTxt + ' al ' + finTxt + '.';
  } else if (ahora < inicio) {
    mensaje = etiquetaModulo + ' abrirá el ' + inicioTxt + ' y cerrará el ' + finTxt + '.';
  } else {
    mensaje = etiquetaModulo + ' cerró el ' + finTxt + '.';
  }

  return {
    abierta: abierta,
    inicio: formatearFechaIsoConfiguracion_(inicio, tz),
    fin: formatearFechaIsoConfiguracion_(fin, tz),
    diasConfigurados: dias,
    etiquetaVentana: inicioTxt + ' al ' + finTxt,
    mensaje: mensaje
  };
}

function obtenerConfiguracionCalendario_(libro) {
  const ss = libro || SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerHojaCalendario_(ss);
  const tz = obtenerTimezone_();

  const quincenaInicio = leerFechaConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.QUINCENA_INICIO);
  const quincenaFin = leerFechaConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.QUINCENA_FIN);
  const mod1Inicio = leerFechaConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.MOD1_INICIO);
  const mod1Fin = leerFechaConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.MOD1_FIN);
  const mod2Inicio = leerFechaConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.MOD2_INICIO);
  const mod2Fin = leerFechaConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.MOD2_FIN);

  const diasAccesoIncidencias = leerNumeroConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.DIAS_ACCESO_INCIDENCIAS, 5);
  const diasAccesoExtras = leerNumeroConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.DIAS_ACCESO_EXTRAS, 5);
  const diasInhabiles = leerDiasInhabilesConfiguracion_(hoja);
  const horariosDestinoHabilitado = leerBooleanConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_HABILITADO);
  const horariosDestinoPeriodo = leerTextoConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_PERIODO);
  const horariosDestinoCuatrimestre = leerTextoConfiguracion_(hoja, CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_CUATRIMESTRE);

  return {
    timezone: tz,
    quincenaInicio: formatearFechaIsoConfiguracion_(quincenaInicio, tz),
    quincenaFin: formatearFechaIsoConfiguracion_(quincenaFin, tz),
    diasAccesoIncidencias: diasAccesoIncidencias,
    diasAccesoExtras: diasAccesoExtras,
    mod1Inicio: formatearFechaIsoConfiguracion_(mod1Inicio, tz),
    mod1Fin: formatearFechaIsoConfiguracion_(mod1Fin, tz),
    mod2Inicio: formatearFechaIsoConfiguracion_(mod2Inicio, tz),
    mod2Fin: formatearFechaIsoConfiguracion_(mod2Fin, tz),
    diasInhabiles: serializarFechasConfiguracion_(diasInhabiles, tz),
    totalDiasInhabiles: diasInhabiles.length,
    horariosDestinoHabilitado: !!(horariosDestinoHabilitado && horariosDestinoPeriodo && horariosDestinoCuatrimestre),
    horariosDestinoPeriodo: horariosDestinoPeriodo,
    horariosDestinoCuatrimestre: horariosDestinoCuatrimestre,
    ventanasCaptura: {
      incidencias: construirVentanaCaptura_(quincenaInicio, quincenaFin, diasAccesoIncidencias, tz, 'Incidencias'),
      extras: construirVentanaCaptura_(quincenaInicio, quincenaFin, diasAccesoExtras, tz, 'Horas extra')
    },
    _quincenaInicio: quincenaInicio,
    _quincenaFin: quincenaFin,
    _mod1Inicio: mod1Inicio,
    _mod1Fin: mod1Fin,
    _mod2Inicio: mod2Inicio,
    _mod2Fin: mod2Fin
  };
}

function serializarConfiguracionCalendarioParaCliente_(cfg) {
  const ciclo = obtenerPeriodoCuatrimestreOperativo_(cfg);
  return {
    timezone: cfg.timezone,
    quincenaInicio: cfg.quincenaInicio,
    quincenaFin: cfg.quincenaFin,
    diasAccesoIncidencias: cfg.diasAccesoIncidencias,
    diasAccesoExtras: cfg.diasAccesoExtras,
    mod1Inicio: cfg.mod1Inicio,
    mod1Fin: cfg.mod1Fin,
    mod2Inicio: cfg.mod2Inicio,
    mod2Fin: cfg.mod2Fin,
    diasInhabiles: cfg.diasInhabiles || [],
    totalDiasInhabiles: cfg.totalDiasInhabiles || 0,
    ventanasCaptura: cfg.ventanasCaptura,
    periodoOperativo: ciclo.periodo || '',
    cuatrimestreOperativo: ciclo.cuatrimestre || '',
    cicloOperativoValido: !!ciclo.valido,
    horariosDestinoHabilitado: !!cfg.horariosDestinoHabilitado,
    horariosDestinoPeriodo: cfg.horariosDestinoPeriodo || '',
    horariosDestinoCuatrimestre: cfg.horariosDestinoCuatrimestre || ''
  };
}

function formatearFechaHumanaCiclo_(fecha, tz) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return '';
  const segura = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0, 0);
  return Utilities.formatDate(segura, tz || obtenerTimezone_(), 'dd/MM/yyyy');
}

function calcularCuatrimestreOperativo_(fechaInicioModulo1) {
  if (!(fechaInicioModulo1 instanceof Date) || isNaN(fechaInicioModulo1.getTime())) {
    return '';
  }

  const mes = fechaInicioModulo1.getMonth() + 1;
  const anio = fechaInicioModulo1.getFullYear();

  if (mes >= 9 && mes <= 12) {
    return (anio + 1) + '-1';
  }

  if (mes >= 1 && mes <= 4) {
    return anio + '-2';
  }

  return anio + '-3';
}

function obtenerPeriodoCuatrimestreOperativo_(cfg) {
  const config = cfg || {};
  const tz = config.timezone || obtenerTimezone_();
  const inicio = config._mod1Inicio || null;
  const fin = config._mod2Fin || null;
  const periodo = (inicio && fin)
    ? (formatearFechaHumanaCiclo_(inicio, tz) + ' al ' + formatearFechaHumanaCiclo_(fin, tz))
    : '';
  const cuatrimestre = calcularCuatrimestreOperativo_(inicio);

  return {
    periodo: periodo,
    cuatrimestre: cuatrimestre,
    valido: !!(periodo && cuatrimestre),
    inicio: inicio,
    fin: fin,
    timezone: tz
  };
}

function asegurarColumnasCicloHorarios_(hojaHorarios) {
  if (!hojaHorarios) return;
  if ((hojaHorarios.getRange(1, 18).getValue() || '').toString().trim() !== 'PERIODO') {
    hojaHorarios.getRange(1, 18).setValue('PERIODO');
  }
  if ((hojaHorarios.getRange(1, 19).getValue() || '').toString().trim() !== 'CUATRIMESTRE') {
    hojaHorarios.getRange(1, 19).setValue('CUATRIMESTRE');
  }
}

function asegurarColumnasCicloExtras_(hojaExtras) {
  if (!hojaExtras) return;
  if ((hojaExtras.getRange(1, 13).getValue() || '').toString().trim() !== 'PERIODO') {
    hojaExtras.getRange(1, 13).setValue('PERIODO');
  }
  if ((hojaExtras.getRange(1, 14).getValue() || '').toString().trim() !== 'CUATRIMESTRE') {
    hojaExtras.getRange(1, 14).setValue('CUATRIMESTRE');
  }
}

function usuarioPuedeAdministrarCalendario_(sesion) {
  const rol = ((sesion && sesion.rol) || '').toString().trim().toLowerCase();
  return rol === 'admin';
}

function obtenerAccesoCapturaPorModulo_(sesion, modulo, libro) {
  const cfg = obtenerConfiguracionCalendario_(libro);
  const ventana = (cfg.ventanasCaptura && cfg.ventanasCaptura[modulo]) || { abierta: true, mensaje: '' };
  const esAdmin = !!(sesion && sesion.esAdmin);

  return {
    modulo: modulo,
    permitido: esAdmin ? true : !!ventana.abierta,
    esAdminBypass: esAdmin,
    abierta: !!ventana.abierta,
    inicio: ventana.inicio || '',
    fin: ventana.fin || '',
    diasConfigurados: ventana.diasConfigurados || 0,
    etiquetaVentana: ventana.etiquetaVentana || '',
    mensaje: esAdmin
      ? 'Acceso habilitado por administrador. Ventana configurada: ' + ((ventana && ventana.etiquetaVentana) || 'sin definir') + '.'
      : ((ventana && ventana.mensaje) || 'Sin configuración de captura.'),
    configuracion: serializarConfiguracionCalendarioParaCliente_(cfg)
  };
}

function validarAccesoCapturaPorModulo_(sesion, modulo, libro) {
  const acceso = obtenerAccesoCapturaPorModulo_(sesion, modulo, libro);
  if (!acceso.permitido) {
    throw new Error(acceso.mensaje || 'La ventana de captura está cerrada.');
  }
  return acceso;
}

function obtenerPanelConfiguracionCalendario(token) {
  try {
    const sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede acceder a esta configuración.' };
    }
    const cfg = obtenerConfiguracionCalendario_(SpreadsheetApp.getActiveSpreadsheet());
    return {
      success: true,
      rol: sesion.rol || '',
      configuracion: serializarConfiguracionCalendarioParaCliente_(cfg)
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function guardarConfiguracionCalendario(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede modificar esta configuración.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = obtenerHojaCalendario_(libro);
    const quincenaInicio = parseFechaIsoConfiguracion_(datos.quincenaInicio);
    const quincenaFin = parseFechaIsoConfiguracion_(datos.quincenaFin);
    const mod1Inicio = parseFechaIsoConfiguracion_(datos.mod1Inicio);
    const mod1Fin = parseFechaIsoConfiguracion_(datos.mod1Fin);
    const mod2Inicio = parseFechaIsoConfiguracion_(datos.mod2Inicio);
    const mod2Fin = parseFechaIsoConfiguracion_(datos.mod2Fin);
    const diasAccesoIncidencias = Math.max(0, parseInt(datos.diasAccesoIncidencias, 10) || 0);
    const diasAccesoExtras = Math.max(0, parseInt(datos.diasAccesoExtras, 10) || 0);
    const diasInhabiles = parseListaFechasIsoConfiguracion_(datos.diasInhabiles || []);
    const horariosDestinoHabilitado = !!datos.horariosDestinoHabilitado;
    const horariosDestinoPeriodo = (datos.horariosDestinoPeriodo || '').toString().trim();
    const horariosDestinoCuatrimestre = (datos.horariosDestinoCuatrimestre || '').toString().trim();

    if (!quincenaInicio || !quincenaFin) return { success: false, error: 'Debes capturar inicio y fin de quincena.' };
    if (!mod1Inicio || !mod1Fin || !mod2Inicio || !mod2Fin) return { success: false, error: 'Debes capturar inicio y cierre de Mod 1 y Mod 2.' };
    if (quincenaInicio > quincenaFin) return { success: false, error: 'La fecha inicial de la quincena no puede ser mayor que la final.' };
    if (mod1Inicio > mod1Fin) return { success: false, error: 'La fecha inicial de Mod 1 no puede ser mayor que la final.' };
    if (mod2Inicio > mod2Fin) return { success: false, error: 'La fecha inicial de Mod 2 no puede ser mayor que la final.' };
    if (diasAccesoIncidencias > 31 || diasAccesoExtras > 31) {
      return { success: false, error: 'Los días de acceso no pueden ser mayores a 31.' };
    }
    if (horariosDestinoHabilitado && (!horariosDestinoPeriodo || !horariosDestinoCuatrimestre)) {
      return { success: false, error: 'Si habilitas el ciclo destino para Horarios, debes capturar Periodo destino y Cuatrimestre destino.' };
    }

    hoja.getRange(CALENDARIO_CFG_CELDAS_.QUINCENA_INICIO).setValue(quincenaInicio).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.QUINCENA_FIN).setValue(quincenaFin).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.DIAS_ACCESO_INCIDENCIAS).setValue(diasAccesoIncidencias);
    hoja.getRange(CALENDARIO_CFG_CELDAS_.DIAS_ACCESO_EXTRAS).setValue(diasAccesoExtras);
    hoja.getRange(CALENDARIO_CFG_CELDAS_.MOD1_INICIO).setValue(mod1Inicio).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.MOD1_FIN).setValue(mod1Fin).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.MOD2_INICIO).setValue(mod2Inicio).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.MOD2_FIN).setValue(mod2Fin).setNumberFormat('dd/mm/yyyy');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_HABILITADO).setValue(horariosDestinoHabilitado);
    hoja.getRange(CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_PERIODO).setValue(horariosDestinoHabilitado ? horariosDestinoPeriodo : '');
    hoja.getRange(CALENDARIO_CFG_CELDAS_.HORARIOS_DESTINO_CUATRIMESTRE).setValue(horariosDestinoHabilitado ? horariosDestinoCuatrimestre : '');
    guardarDiasInhabilesConfiguracion_(hoja, diasInhabiles);

    const cfg = obtenerConfiguracionCalendario_(libro);
    return {
      success: true,
      message: 'Configuración de calendario actualizada correctamente.',
      configuracion: serializarConfiguracionCalendarioParaCliente_(cfg)
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


function rellenarPeriodoCuatrimestreRegistrosActivos(token) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    if (!usuarioPuedeAdministrarCalendario_(sesion)) {
      return { success: false, error: 'Solo el administrador puede ejecutar esta acción.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const cfg = obtenerConfiguracionCalendario_(libro);
    const ciclo = obtenerPeriodoCuatrimestreOperativo_(cfg);
    if (!ciclo.valido) {
      return { success: false, error: 'La configuración de calendario no tiene un periodo/cuatrimestre operativo válido. Revisa Inicio Mod 1 y Fin Mod 2.' };
    }

    const resumen = {
      periodo: ciclo.periodo,
      cuatrimestre: ciclo.cuatrimestre,
      horariosActualizados: 0,
      extrasActualizados: 0
    };

    const hojaHorarios = libro.getSheetByName('Horarios Doc');
    if (hojaHorarios && hojaHorarios.getLastRow() > 1) {
      asegurarColumnasCicloHorarios_(hojaHorarios);
      const totalFilasHorarios = hojaHorarios.getLastRow() - 1;
      const datosHorarios = hojaHorarios.getRange(2, 1, totalFilasHorarios, Math.max(hojaHorarios.getLastColumn(), 19)).getValues();
      const periodoUpdates = [];
      const cuatrimestreUpdates = [];

      datosHorarios.forEach(function(fila) {
        const tieneRegistro = !!((fila[1] || '').toString().trim() || (fila[2] || '').toString().trim());
        const periodoActual = (fila[17] || '').toString().trim();
        const cuatrimestreActual = (fila[18] || '').toString().trim();
        const necesitaRelleno = tieneRegistro && (!periodoActual || !cuatrimestreActual);
        periodoUpdates.push([necesitaRelleno ? ciclo.periodo : periodoActual]);
        cuatrimestreUpdates.push([necesitaRelleno ? ciclo.cuatrimestre : cuatrimestreActual]);
        if (necesitaRelleno) resumen.horariosActualizados++;
      });

      hojaHorarios.getRange(2, 18, totalFilasHorarios, 1).setValues(periodoUpdates);
      hojaHorarios.getRange(2, 19, totalFilasHorarios, 1).setValues(cuatrimestreUpdates);
    }

    const hojaExtras = asegurarHojaExtras_(libro);
    if (hojaExtras && hojaExtras.getLastRow() > 1) {
      asegurarColumnasCicloExtras_(hojaExtras);
      const totalFilasExtras = hojaExtras.getLastRow() - 1;
      const datosExtras = hojaExtras.getRange(2, 1, totalFilasExtras, Math.max(hojaExtras.getLastColumn(), 14)).getValues();
      const periodoUpdates = [];
      const cuatrimestreUpdates = [];

      datosExtras.forEach(function(fila) {
        const tieneRegistro = !!(fila[2] || '').toString().trim();
        const periodoActual = (fila[12] || '').toString().trim();
        const cuatrimestreActual = (fila[13] || '').toString().trim();
        const necesitaRelleno = tieneRegistro && (!periodoActual || !cuatrimestreActual);
        periodoUpdates.push([necesitaRelleno ? ciclo.periodo : periodoActual]);
        cuatrimestreUpdates.push([necesitaRelleno ? ciclo.cuatrimestre : cuatrimestreActual]);
        if (necesitaRelleno) resumen.extrasActualizados++;
      });

      hojaExtras.getRange(2, 13, totalFilasExtras, 1).setValues(periodoUpdates);
      hojaExtras.getRange(2, 14, totalFilasExtras, 1).setValues(cuatrimestreUpdates);
    }

    return {
      success: true,
      message: 'Se actualizaron los registros activos sin periodo/cuatrimestre.',
      resumen: resumen,
      configuracion: serializarConfiguracionCalendarioParaCliente_(cfg)
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}

function obtenerBitacoraEliminadosHorarios(token) {
  try {
    const sesion = validarSesionSegura_(token);
    if (!sesion.esAdmin) {
      return { success: false, error: 'Solo el administrador puede consultar la bitácora de eliminados.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = asegurarHojaBitacoraEliminadosHorarios_(libro);
    const registros = [];
    const resumen = {
      totalRegistros: 0,
      totalDocentes: 0,
      totalCoordinaciones: 0,
      totalHorasBase: 0,
      totalHorasIncidencias: 0
    };

    if (hoja.getLastRow() > 1) {
      const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, BITACORA_ELIMINADOS_HORARIOS_HEADERS_.length).getValues();
      const docentes = {};
      const coordinaciones = {};

      datos.forEach(function(fila, idx) {
        const registro = {
          filaBitacora: idx + 2,
          fechaEliminacion: (fila[0] || '').toString().trim(),
          usuarioEliminacion: (fila[1] || '').toString().trim(),
          rolEliminacion: (fila[2] || '').toString().trim(),
          coordinadorSesion: (fila[3] || '').toString().trim(),
          hojaOrigen: (fila[4] || '').toString().trim(),
          filaOrigen: parseInt(fila[5], 10) || '',
          coordinadorRegistro: (fila[6] || '').toString().trim(),
          asignatura: (fila[7] || '').toString().trim(),
          docente: (fila[8] || '').toString().trim(),
          grupo: (fila[9] || '').toString().trim(),
          tabulador: (fila[10] || '').toString().trim(),
          montoTabulador: parseFloat(fila[11]) || 0,
          l: parseFloat(fila[12]) || 0,
          m: parseFloat(fila[13]) || 0,
          x: parseFloat(fila[14]) || 0,
          j: parseFloat(fila[15]) || 0,
          v: parseFloat(fila[16]) || 0,
          s1: parseFloat(fila[17]) || 0,
          s2: parseFloat(fila[18]) || 0,
          horasBase: parseFloat(fila[19]) || 0,
          faltas: parseFloat(fila[20]) || 0,
          retardos: parseFloat(fila[21]) || 0,
          extras: parseFloat(fila[22]) || 0,
          totalSemana: parseFloat(fila[23]) || 0,
          totalMod1: parseFloat(fila[24]) || 0,
          totalMod2: parseFloat(fila[25]) || 0
        };

        registros.push(registro);
        resumen.totalRegistros += 1;
        resumen.totalHorasBase += registro.horasBase;
        resumen.totalHorasIncidencias += registro.faltas + registro.extras;
        if (registro.docente) docentes[registro.docente] = true;
        if (registro.coordinadorRegistro) coordinaciones[registro.coordinadorRegistro] = true;
      });

      resumen.totalDocentes = Object.keys(docentes).length;
      resumen.totalCoordinaciones = Object.keys(coordinaciones).length;
    }

    registros.sort(function(a, b) {
      return (b.filaBitacora || 0) - (a.filaBitacora || 0);
    });

    return {
      success: true,
      rol: sesion.rol || '',
      registros: registros,
      resumen: resumen
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function obtenerUsuariosAcceso(token) {
  try {
    const sesion = validarSesionSegura_(token);
    validarAdminGestionAccesos_(sesion);

    const usuarios = listarUsuariosAcceso_(SpreadsheetApp.getActiveSpreadsheet()).sort(function(a, b) {
      return (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' });
    });
    const resumen = obtenerResumenUsuariosAcceso_(usuarios);
    const roles = Object.keys(ROLES_USUARIOS_ACCESO_PERMITIDOS_).sort();

    return {
      success: true,
      usuarios: usuarios,
      resumen: resumen,
      roles: roles,
      usuarioSesion: sesion.usuario || '',
      nombreSesion: sesion.nombre || ''
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function guardarUsuarioAcceso(token, payload) {
  try {
    const sesion = validarSesionSegura_(token);
    validarAdminGestionAccesos_(sesion);

    const datos = payload || {};
    const nombre = (datos.nombre || '').toString().trim();
    const usuario = (datos.usuario || '').toString().trim();
    const password = (datos.password || '').toString().trim();
    const filaHoja = parseInt(datos.filaHoja, 10) || null;

    if (!nombre || !usuario) {
      return { success: false, error: 'Captura nombre y usuario para guardar el acceso.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = asegurarHojaUsuariosAcceso_(libro);
    const usuarios = listarUsuariosAcceso_(libro);
    const usuarioDuplicado = usuarios.find(function(item) {
      return item.usuario.toLowerCase() === usuario.toLowerCase() && item.filaHoja !== filaHoja;
    });

    if (usuarioDuplicado) {
      return { success: false, error: 'Ya existe un usuario registrado con ese acceso.' };
    }

    if (!filaHoja && !password) {
      return { success: false, error: 'La contraseña es obligatoria para crear un usuario nuevo.' };
    }

    if (filaHoja) {
      const existente = usuarios.find(function(item) { return item.filaHoja === filaHoja; });
      if (!existente) {
        return { success: false, error: 'No fue posible localizar el usuario a editar.' };
      }

      const rolNuevo = normalizarRolUsuarioAcceso_(datos.rol || existente.rol);
      const estatusNuevo = normalizarEstatusUsuarioAcceso_(datos.estatus || existente.estatus);

      if (existente.usuario.toLowerCase() === (sesion.usuario || '').toLowerCase() && (rolNuevo !== 'admin' || estatusNuevo !== 'ACTIVO')) {
        return { success: false, error: 'No puedes quitarte el rol admin ni inactivar tu propio acceso desde esta sesión.' };
      }

      if (existente.rol === 'admin' && (rolNuevo !== 'admin' || estatusNuevo !== 'ACTIVO') && !puedeQuitarAdmin_(usuarios, filaHoja)) {
        return { success: false, error: 'Debe permanecer al menos un administrador activo en el sistema.' };
      }

      const passwordFinal = password || existente.pass;
      if (!passwordFinal) {
        return { success: false, error: 'La contraseña no puede quedar vacía.' };
      }

      const filaActual = hoja.getRange(filaHoja, 1, 1, Math.max(hoja.getLastColumn(), USUARIOS_ACCESO_HEADERS_.length)).getValues()[0];
      const filaNueva = prepararFilaUsuarioAcceso_(filaActual, {
        nombre: nombre,
        observacion: datos.observacion || existente.observacion || '',
        usuario: usuario,
        rol: rolNuevo,
        estatus: estatusNuevo
      }, passwordFinal, sesion, true);
      hoja.getRange(filaHoja, 1, 1, USUARIOS_ACCESO_HEADERS_.length).setValues([filaNueva]);

      return { success: true, message: 'Usuario actualizado correctamente.' };
    }

    const filaNueva = prepararFilaUsuarioAcceso_([], {
      nombre: nombre,
      observacion: datos.observacion || '',
      usuario: usuario,
      rol: datos.rol || 'coordinador',
      estatus: datos.estatus || 'ACTIVO'
    }, password, sesion, false);
    hoja.appendRow(filaNueva);

    return { success: true, message: 'Usuario creado correctamente.' };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function cambiarEstatusUsuarioAcceso(token, payload) {
  try {
    const sesion = validarSesionSegura_(token);
    validarAdminGestionAccesos_(sesion);

    const filaHoja = parseInt(payload && payload.filaHoja, 10) || null;
    const nuevoEstatus = normalizarEstatusUsuarioAcceso_(payload && payload.estatus);
    if (!filaHoja) {
      return { success: false, error: 'No se recibió el usuario que se desea actualizar.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = asegurarHojaUsuariosAcceso_(libro);
    const usuarios = listarUsuariosAcceso_(libro);
    const existente = usuarios.find(function(item) { return item.filaHoja === filaHoja; });
    if (!existente) {
      return { success: false, error: 'No fue posible localizar el usuario solicitado.' };
    }

    if (existente.usuario.toLowerCase() === (sesion.usuario || '').toLowerCase() && nuevoEstatus !== 'ACTIVO') {
      return { success: false, error: 'No puedes inactivar tu propio acceso desde esta sesión.' };
    }

    if (existente.rol === 'admin' && nuevoEstatus !== 'ACTIVO' && !puedeQuitarAdmin_(usuarios, filaHoja)) {
      return { success: false, error: 'Debe permanecer al menos un administrador activo en el sistema.' };
    }

    const filaActual = hoja.getRange(filaHoja, 1, 1, Math.max(hoja.getLastColumn(), USUARIOS_ACCESO_HEADERS_.length)).getValues()[0];
    const filaNueva = prepararFilaUsuarioAcceso_(filaActual, {
      nombre: existente.nombre,
      observacion: existente.observacion || '',
      usuario: existente.usuario,
      rol: existente.rol,
      estatus: nuevoEstatus
    }, existente.pass, sesion, true);
    hoja.getRange(filaHoja, 1, 1, USUARIOS_ACCESO_HEADERS_.length).setValues([filaNueva]);

    return { success: true, message: 'Estatus actualizado correctamente.' };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function eliminarUsuarioAcceso(token, payload) {
  try {
    const sesion = validarSesionSegura_(token);
    validarAdminGestionAccesos_(sesion);

    const filaHoja = parseInt(payload && payload.filaHoja, 10) || null;
    if (!filaHoja) {
      return { success: false, error: 'No se recibió el usuario que se desea eliminar.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = asegurarHojaUsuariosAcceso_(libro);
    const usuarios = listarUsuariosAcceso_(libro);
    const existente = usuarios.find(function(item) { return item.filaHoja === filaHoja; });
    if (!existente) {
      return { success: false, error: 'No fue posible localizar el usuario solicitado.' };
    }

    if (existente.usuario.toLowerCase() === (sesion.usuario || '').toLowerCase()) {
      return { success: false, error: 'No puedes eliminar tu propio acceso desde esta sesión.' };
    }

    if (existente.rol === 'admin' && existente.estatus === 'ACTIVO' && !puedeQuitarAdmin_(usuarios, filaHoja)) {
      return { success: false, error: 'Debe permanecer al menos un administrador activo en el sistema.' };
    }

    hoja.deleteRow(filaHoja);
    return { success: true, message: 'Usuario eliminado correctamente.' };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

// Función para validar el inicio de sesión
function validarCredenciales(usuario, pass) {
  try {
    const registro = obtenerRegistroUsuario_(usuario);

    if (!registro) {
      return { success: false, message: 'Usuario o contraseña incorrectos' };
    }

    if (registro.pass !== (pass || '').toString().trim()) {
      return { success: false, message: 'Usuario o contraseña incorrectos' };
    }

    if (registro.estatus !== 'ACTIVO') {
      return { success: false, message: 'Este usuario está inactivo. Contacta al administrador.' };
    }

    const sesionCreada = crearSesionSegura_(registro.usuario, registro.nombre, registro.rol);

    return {
      success: true,
      nombre: registro.nombre,
      rol: registro.rol,
      esAdmin: registro.esAdmin,
      token: sesionCreada.token
    };
  } catch (e) {
    return { success: false, message: 'Error: ' + e.toString() };
  }
}

// ... tus funciones doGet y validarCredenciales anteriores ...

// Nueva función para obtener el resumen de la nómina
function obtenerDatosDashboard() {
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaNomina = libro.getSheetByName('Nomina'); // Debe coincidir exactamente con el nombre de tu pestaña
    
    if (!hojaNomina) {
      return { success: false, error: 'No se encontró la hoja "Nomina".' };
    }

    // getDisplayValues trae los textos tal cual se ven (con formato)
    const datos = hojaNomina.getDataRange().getDisplayValues(); 
    
    if (datos.length <= 1) return { success: true, datos: [] }; // Si solo hay encabezados
    
    const encabezados = datos[0];
    // Buscamos los índices de las columnas que queremos mostrar en el resumen
    const idxDocente = encabezados.indexOf('DOCENTE');
    const idxAsignatura = encabezados.indexOf('ASIGNATURA');
    const idxGrupo = encabezados.indexOf('GRUPO');
    const idxHoras = encabezados.indexOf('HORAS BASE');
    
    // Mapeamos las filas a objetos, saltando la fila 0 (encabezados)
    const filas = datos.slice(1).map(fila => {
      return {
         // Usamos el índice encontrado, o un número fijo si por alguna razón falla el nombre
         docente: idxDocente !== -1 ? fila[idxDocente] : fila[2], 
         asignatura: idxAsignatura !== -1 ? fila[idxAsignatura] : fila[1],
         grupo: idxGrupo !== -1 ? fila[idxGrupo] : fila[3],
         horasBase: idxHoras !== -1 ? fila[idxHoras] : fila[13]
      };
    }).filter(f => f.docente && f.docente.trim() !== ''); // Filtramos filas vacías

    return { success: true, datos: filas };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}


//Fase 3
// --- FUNCIONES PARA CAPTURAR / EDITAR DOCENTES ---
const DIRECTORIO_COLUMNAS_REQUERIDAS_ = [
  'DOCENTE',
  'GRADO',
  'TIPO DE PAGO',
  'CATEGORIA',
  'COMENTARIO',
  'UBICACION',
  'OBSERVACION',
  'COORDINADOR',
  'TELEFONO',
  'CORREO',
  'RFC',
  'IDENTIFICADOR',
  'BANCO DETALLE',
  'ESTATUS',
  'CONSTANCIA FILE ID',
  'CONSTANCIA URL',
  'CONSTANCIA NOMBRE',
  'CONSTANCIA FECHA',
  'CONSTANCIA ACTUALIZADA POR',
  'NOMBRE NORMALIZADO',
  'NOMBRES',
  'APELLIDO PATERNO',
  'APELLIDO MATERNO',
  'ID DOCENTE',
  'FECHA CREACION',
  'CREADO POR',
  'FECHA ACTUALIZACION',
  'ACTUALIZADO POR'
];

function normalizarTextoDocenteServidor_(valor) {
  return (valor || '')
    .toString()
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizarCabeceraDirectorio_(valor) {
  return (valor || '')
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarNombreComparable_(valor) {
  return (valor || '')
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarTextoLibre_(valor, maxLen) {
  let texto = (valor || '').toString().replace(/\s+/g, ' ').trim();
  if (maxLen && texto.length > maxLen) {
    texto = texto.substring(0, maxLen).trim();
  }
  return texto;
}

function normalizarTelefonoDocente_(valor) {
  return (valor || '').toString().replace(/[^0-9+]/g, '').trim();
}

function normalizarCorreoDocente_(valor) {
  return (valor || '').toString().trim().toLowerCase();
}

function normalizarRFCDocente_(valor) {
  return (valor || '').toString().toUpperCase().replace(/\s+/g, '').trim();
}

function generarFechaHoraTexto_(fecha) {
  return Utilities.formatDate(fecha || new Date(), obtenerTimezone_(), 'dd/MM/yyyy HH:mm:ss');
}

function asegurarColumnasDirectorio_(hoja) {
  const ultimaColumna = Math.max(hoja.getLastColumn(), 1);
  const encabezadosActuales = hoja.getRange(1, 1, 1, ultimaColumna).getValues()[0];
  const mapaActual = {};

  encabezadosActuales.forEach((encabezado, idx) => {
    const clave = normalizarCabeceraDirectorio_(encabezado);
    if (clave) {
      mapaActual[clave] = idx + 1;
    }
  });

  if (ultimaColumna === 1 && !encabezadosActuales[0]) {
    hoja.getRange(1, 1, 1, DIRECTORIO_COLUMNAS_REQUERIDAS_.length).setValues([DIRECTORIO_COLUMNAS_REQUERIDAS_]);
    hoja.getRange(1, 1, 1, DIRECTORIO_COLUMNAS_REQUERIDAS_.length).setFontWeight('bold').setBackground('#DBEAFE');
  } else {
    DIRECTORIO_COLUMNAS_REQUERIDAS_.forEach(nombre => {
      const clave = normalizarCabeceraDirectorio_(nombre);
      if (!mapaActual[clave]) {
        const nuevaColumna = hoja.getLastColumn() + 1;
        hoja.getRange(1, nuevaColumna).setValue(nombre);
        hoja.getRange(1, nuevaColumna).setFontWeight('bold').setBackground('#DBEAFE');
        mapaActual[clave] = nuevaColumna;
      }
    });
  }

  const ultimaColumnaFinal = hoja.getLastColumn();
  const encabezadosFinales = hoja.getRange(1, 1, 1, ultimaColumnaFinal).getValues()[0];
  const mapa = {};
  encabezadosFinales.forEach((encabezado, idx) => {
    const clave = normalizarCabeceraDirectorio_(encabezado);
    if (clave) {
      mapa[clave] = idx + 1;
    }
  });

  return mapa;
}

function indiceDirectorio_(mapa, nombre) {
  const indice = mapa[normalizarCabeceraDirectorio_(nombre)];
  return indice ? (indice - 1) : -1;
}

function obtenerValorFilaDirectorio_(fila, mapa, nombre) {
  const idx = indiceDirectorio_(mapa, nombre);
  return idx >= 0 ? fila[idx] : '';
}

function descomponerNombreDocente_(nombreCompleto) {
  const tokens = normalizarTextoDocenteServidor_(nombreCompleto).split(' ').filter(Boolean);

  if (tokens.length >= 4) {
    return {
      nombres: tokens.slice(0, -2).join(' '),
      apellidoPaterno: tokens[tokens.length - 2],
      apellidoMaterno: tokens[tokens.length - 1]
    };
  }

  if (tokens.length === 3) {
    return {
      nombres: tokens[0],
      apellidoPaterno: tokens[1],
      apellidoMaterno: tokens[2]
    };
  }

  if (tokens.length === 2) {
    return {
      nombres: tokens[0],
      apellidoPaterno: tokens[1],
      apellidoMaterno: ''
    };
  }

  return {
    nombres: tokens[0] || '',
    apellidoPaterno: '',
    apellidoMaterno: ''
  };
}

function calcularSimilitudTokens_(a, b) {
  const tokensA = Array.from(new Set((a || '').split(' ').filter(Boolean)));
  const tokensB = Array.from(new Set((b || '').split(' ').filter(Boolean)));

  if (!tokensA.length || !tokensB.length) return 0;

  const setB = {};
  tokensB.forEach(t => setB[t] = true);

  let comunes = 0;
  tokensA.forEach(t => {
    if (setB[t]) comunes++;
  });

  const union = new Set(tokensA.concat(tokensB)).size;
  return union ? (comunes / union) : 0;
}

function leerDirectorioCompleto_(hoja, mapa) {
  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();
  if (ultimaFila < 2) return [];

  const datos = hoja.getRange(2, 1, ultimaFila - 1, ultimaColumna).getValues();

  return datos.map((fila, idx) => {
    const docente = normalizarTextoDocenteServidor_(obtenerValorFilaDirectorio_(fila, mapa, 'DOCENTE'));
    const idDocente = (obtenerValorFilaDirectorio_(fila, mapa, 'ID DOCENTE') || '').toString().trim();

    if (!docente && !idDocente) return null;

    const partesDerivadas = descomponerNombreDocente_(docente);

    return {
      filaHoja: idx + 2,
      idDocente: idDocente || Utilities.getUuid(),
      docente: docente,
      grado: (obtenerValorFilaDirectorio_(fila, mapa, 'GRADO') || '').toString().trim(),
      tipoPago1: (obtenerValorFilaDirectorio_(fila, mapa, 'TIPO DE PAGO') || '').toString().trim().toUpperCase(),
      categoria: (obtenerValorFilaDirectorio_(fila, mapa, 'CATEGORIA') || '').toString().trim().toUpperCase(),
      ubicacion: (obtenerValorFilaDirectorio_(fila, mapa, 'UBICACION') || obtenerValorFilaDirectorio_(fila, mapa, 'TIPO DE PAGO') || '').toString().trim(),
      comentario: (obtenerValorFilaDirectorio_(fila, mapa, 'COMENTARIO') || '').toString().trim(),
      observacion: (obtenerValorFilaDirectorio_(fila, mapa, 'OBSERVACION') || '').toString().trim(),
      coordinador: (obtenerValorFilaDirectorio_(fila, mapa, 'COORDINADOR') || '').toString().trim(),
      telefono: (obtenerValorFilaDirectorio_(fila, mapa, 'TELEFONO') || '').toString().trim(),
      correo: (obtenerValorFilaDirectorio_(fila, mapa, 'CORREO') || '').toString().trim(),
      rfc: (obtenerValorFilaDirectorio_(fila, mapa, 'RFC') || '').toString().trim(),
      identificador: (obtenerValorFilaDirectorio_(fila, mapa, 'IDENTIFICADOR') || '').toString().trim(),
      bancoDetalle: (obtenerValorFilaDirectorio_(fila, mapa, 'BANCO DETALLE') || '').toString().trim(),
      estatus: (obtenerValorFilaDirectorio_(fila, mapa, 'ESTATUS') || 'ACTIVO').toString().trim().toUpperCase(),
      constanciaFileId: (obtenerValorFilaDirectorio_(fila, mapa, 'CONSTANCIA FILE ID') || '').toString().trim(),
      constanciaUrl: (obtenerValorFilaDirectorio_(fila, mapa, 'CONSTANCIA URL') || '').toString().trim(),
      constanciaNombre: (obtenerValorFilaDirectorio_(fila, mapa, 'CONSTANCIA NOMBRE') || '').toString().trim(),
      constanciaFecha: (obtenerValorFilaDirectorio_(fila, mapa, 'CONSTANCIA FECHA') || '').toString().trim(),
      constanciaActualizadaPor: (obtenerValorFilaDirectorio_(fila, mapa, 'CONSTANCIA ACTUALIZADA POR') || '').toString().trim(),
      nombreNormalizado: normalizarNombreComparable_(obtenerValorFilaDirectorio_(fila, mapa, 'NOMBRE NORMALIZADO') || docente),
      nombres: normalizarTextoDocenteServidor_(obtenerValorFilaDirectorio_(fila, mapa, 'NOMBRES') || partesDerivadas.nombres),
      apellidoPaterno: normalizarTextoDocenteServidor_(obtenerValorFilaDirectorio_(fila, mapa, 'APELLIDO PATERNO') || partesDerivadas.apellidoPaterno),
      apellidoMaterno: normalizarTextoDocenteServidor_(obtenerValorFilaDirectorio_(fila, mapa, 'APELLIDO MATERNO') || partesDerivadas.apellidoMaterno),
      fechaCreacion: (obtenerValorFilaDirectorio_(fila, mapa, 'FECHA CREACION') || '').toString().trim(),
      creadoPor: (obtenerValorFilaDirectorio_(fila, mapa, 'CREADO POR') || '').toString().trim(),
      fechaActualizacion: (obtenerValorFilaDirectorio_(fila, mapa, 'FECHA ACTUALIZACION') || '').toString().trim(),
      actualizadoPor: (obtenerValorFilaDirectorio_(fila, mapa, 'ACTUALIZADO POR') || '').toString().trim()
    };
  }).filter(Boolean);
}

function obtenerCoincidenciasDocente_(registros, nombreCompleto, filaOmitir) {
  const claveObjetivo = normalizarNombreComparable_(nombreCompleto);
  if (!claveObjetivo) {
    return { exacta: null, similares: [] };
  }

  let exacta = null;
  const similares = [];

  registros.forEach(reg => {
    if (!reg || !reg.docente) return;
    if (filaOmitir && reg.filaHoja === filaOmitir) return;

    const claveRegistro = reg.nombreNormalizado || normalizarNombreComparable_(reg.docente);

    if (claveRegistro === claveObjetivo) {
      exacta = reg;
      return;
    }

    const similitud = calcularSimilitudTokens_(claveObjetivo, claveRegistro);
    const incluye = claveRegistro.indexOf(claveObjetivo) !== -1 || claveObjetivo.indexOf(claveRegistro) !== -1;

    if (similitud >= 0.6 || incluye) {
      similares.push({
        filaHoja: reg.filaHoja,
        docente: reg.docente,
        coordinador: reg.coordinador,
        estatus: reg.estatus,
        similitud: similitud
      });
    }
  });

  similares.sort((a, b) => b.similitud - a.similitud);

  return {
    exacta: exacta,
    similares: similares.slice(0, 5)
  };
}

function asegurarHistorialDirectorio_(libro) {
  let hojaHistorial = libro.getSheetByName('Historial Directorio');
  if (!hojaHistorial) {
    hojaHistorial = libro.insertSheet('Historial Directorio');
    hojaHistorial.getRange(1, 1, 1, 10).setValues([[
      'FECHA',
      'ACCION',
      'ID DOCENTE',
      'DOCENTE',
      'USUARIO',
      'COORDINADOR SESION',
      'DETALLE',
      'ESTATUS',
      'TIPO PAGO',
      'CATEGORIA'
    ]]);
    hojaHistorial.getRange('A1:J1').setFontWeight('bold').setBackground('#E0E7FF');
  }
  return hojaHistorial;
}

function construirDetalleCambioDocente_(antes, despues) {
  if (!antes) {
    return 'Alta inicial del docente.';
  }

  const campos = [
    ['DOCENTE', 'docente'],
    ['GRADO', 'grado'],
    ['TIPO PAGO', 'tipoPago1'],
    ['CATEGORIA', 'categoria'],
    ['UBICACION', 'ubicacion'],
    ['ESTATUS', 'estatus'],
    ['CORREO', 'correo'],
    ['TELEFONO', 'telefono'],
    ['RFC', 'rfc'],
    ['IDENTIFICADOR', 'identificador'],
    ['BANCO DETALLE', 'bancoDetalle'],
    ['COMENTARIO', 'comentario'],
    ['OBSERVACION', 'observacion'],
    ['CONSTANCIA NOMBRE', 'constanciaNombre'],
    ['CONSTANCIA FECHA', 'constanciaFecha']
  ];

  const cambios = [];

  campos.forEach(([titulo, clave]) => {
    const valorAntes = ((antes && antes[clave]) || '').toString().trim();
    const valorDespues = ((despues && despues[clave]) || '').toString().trim();
    if (valorAntes !== valorDespues) {
      cambios.push(`${titulo}: "${valorAntes || '-'}" → "${valorDespues || '-'}"`);
    }
  });

  return cambios.length ? cambios.join(' | ') : 'Sin cambios sustanciales en campos monitoreados.';
}

function registrarHistorialDirectorio_(libro, accion, sesion, antes, despues) {
  const hojaHistorial = asegurarHistorialDirectorio_(libro);
  hojaHistorial.appendRow([
    generarFechaHoraTexto_(new Date()),
    accion,
    (despues && despues.idDocente) || (antes && antes.idDocente) || '',
    (despues && despues.docente) || (antes && antes.docente) || '',
    (sesion.usuario || '').toString().trim(),
    (sesion.nombre || '').toString().trim(),
    construirDetalleCambioDocente_(antes, despues),
    (despues && despues.estatus) || (antes && antes.estatus) || '',
    (despues && despues.tipoPago1) || (antes && antes.tipoPago1) || '',
    (despues && despues.categoria) || (antes && antes.categoria) || ''
  ]);
}

const CONSTANCIAS_FOLDER_PROPERTY_ = 'NOMINA_DOCENTE_CONSTANCIAS_FOLDER_ID';
const CONSTANCIAS_FOLDER_NAME_ = 'Nomina Docente - Constancias Fiscales';

function registrarMovimientoDirectorio_(libro, accion, sesion, docente, detalle) {
  const hojaHistorial = asegurarHistorialDirectorio_(libro);
  hojaHistorial.appendRow([
    generarFechaHoraTexto_(new Date()),
    accion,
    (docente && docente.idDocente) || '',
    (docente && docente.docente) || '',
    (sesion.usuario || '').toString().trim(),
    (sesion.nombre || '').toString().trim(),
    detalle || '',
    (docente && docente.estatus) || '',
    (docente && docente.tipoPago1) || '',
    (docente && docente.categoria) || ''
  ]);
}

function sincronizarNombreDocenteEnColumna_(hoja, columna, nombreAnterior, nombreNuevo) {
  if (!hoja || hoja.getLastRow() <= 1 || !nombreAnterior || !nombreNuevo) return 0;

  const claveAnterior = normalizarNombreComparable_(nombreAnterior);
  const totalFilas = hoja.getLastRow() - 1;
  const rango = hoja.getRange(2, columna, totalFilas, 1);
  const valores = rango.getValues();

  let cambios = 0;
  valores.forEach(fila => {
    const actual = (fila[0] || '').toString().trim();
    if (actual && normalizarNombreComparable_(actual) === claveAnterior) {
      fila[0] = nombreNuevo;
      cambios++;
    }
  });

  if (cambios > 0) {
    rango.setValues(valores);
  }

  return cambios;
}

function sincronizarNombreDocenteRelacionado_(libro, nombreAnterior, nombreNuevo) {
  if (!nombreAnterior || !nombreNuevo) {
    return { horarios: 0, extras: 0, total: 0 };
  }

  if (normalizarNombreComparable_(nombreAnterior) === normalizarNombreComparable_(nombreNuevo)) {
    return { horarios: 0, extras: 0, total: 0 };
  }

  const hojaHorarios = libro.getSheetByName('Horarios Doc');
  const hojaExtras = libro.getSheetByName('Extras');

  const horarios = sincronizarNombreDocenteEnColumna_(hojaHorarios, 3, nombreAnterior, nombreNuevo);
  const extras = sincronizarNombreDocenteEnColumna_(hojaExtras, 3, nombreAnterior, nombreNuevo);

  if (horarios > 0) {
    actualizarHojaHorasTotales(libro);
  }

  return {
    horarios: horarios,
    extras: extras,
    total: horarios + extras
  };
}

function obtenerOCrearCarpetaConstancias_() {
  const props = PropertiesService.getScriptProperties();
  const idGuardado = props.getProperty(CONSTANCIAS_FOLDER_PROPERTY_);

  if (idGuardado) {
    try {
      return DriveApp.getFolderById(idGuardado);
    } catch (e) {}
  }

  const existentes = DriveApp.getFoldersByName(CONSTANCIAS_FOLDER_NAME_);
  const carpeta = existentes.hasNext() ? existentes.next() : DriveApp.createFolder(CONSTANCIAS_FOLDER_NAME_);

  props.setProperty(CONSTANCIAS_FOLDER_PROPERTY_, carpeta.getId());
  return carpeta;
}

function obtenerExtensionArchivo_(nombre, mimeType) {
  const limpio = (nombre || '').toString().trim();
  const partes = limpio.split('.');
  const extNombre = partes.length > 1 ? ('.' + partes.pop().toLowerCase()) : '';

  if (extNombre && ['.pdf', '.jpg', '.jpeg', '.png'].includes(extNombre)) {
    return extNombre;
  }

  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/png') return '.png';
  return '';
}

function sanitizarNombreArchivo_(valor) {
  return (valor || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 _.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function obtenerCatalogoDocentes(token) {
  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDirectorio = libro.getSheetByName('Directorio');

    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio".' };
    }

    const mapa = asegurarColumnasDirectorio_(hojaDirectorio);
    const docentes = leerDirectorioCompleto_(hojaDirectorio, mapa)
      .sort((a, b) => a.docente.localeCompare(b.docente, 'es', { sensitivity: 'base' }));

    const hojaHistorial = libro.getSheetByName('Historial Directorio');
    let historialReciente = [];

    if (hojaHistorial && hojaHistorial.getLastRow() > 1) {
      const datosHistorial = hojaHistorial.getDataRange().getValues();
      historialReciente = datosHistorial.slice(1).reverse().slice(0, 15).map(fila => ({
        fecha: (fila[0] || '').toString(),
        accion: (fila[1] || '').toString(),
        idDocente: (fila[2] || '').toString(),
        docente: (fila[3] || '').toString(),
        usuario: (fila[4] || '').toString(),
        coordinadorSesion: (fila[5] || '').toString(),
        detalle: (fila[6] || '').toString(),
        estatus: (fila[7] || '').toString(),
        tipoPago1: (fila[8] || '').toString(),
        categoria: (fila[9] || '').toString()
      }));
    }

    return {
      success: true,
      docenteActual: sesion.nombre || '',
      esAdmin: !!sesion.esAdmin,
      docentes: docentes,
      historialReciente: historialReciente
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}


function obtenerPanelFinanzas(token) {
  try {
    const sesion = validarSesionSegura_(token);
    if (!esUsuarioFinanzas_(sesion)) {
      return { success: false, error: 'Esta vista está disponible para usuarios con rol Admin, Finanzas o Contador.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDirectorio = libro.getSheetByName('Directorio');

    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio".' };
    }

    const mapa = asegurarColumnasDirectorio_(hojaDirectorio);
    const docentes = leerDirectorioCompleto_(hojaDirectorio, mapa)
      .sort((a, b) => a.docente.localeCompare(b.docente, 'es', { sensitivity: 'base' }));

    const resumen = {
      total: docentes.length,
      activos: 0,
      inactivos: 0,
      conConstancia: 0,
      sinConstancia: 0,
      conRFC: 0,
      sinRFC: 0,
      conBanco: 0,
      sinBanco: 0
    };

    const coordinadoresMap = {};

    docentes.forEach(doc => {
      const activo = ((doc.estatus || 'ACTIVO').toString().trim().toUpperCase() === 'ACTIVO');
      const tieneConstancia = !!(doc.constanciaFileId || doc.constanciaUrl || '').toString().trim();
      const tieneRFC = !!(doc.rfc || '').toString().trim();
      const tieneBanco = !!(doc.bancoDetalle || '').toString().trim();

      if (activo) resumen.activos++;
      else resumen.inactivos++;

      if (tieneConstancia) resumen.conConstancia++;
      else resumen.sinConstancia++;

      if (tieneRFC) resumen.conRFC++;
      else resumen.sinRFC++;

      if (tieneBanco) resumen.conBanco++;
      else resumen.sinBanco++;

      const coord = (doc.coordinador || '').toString().trim();
      if (coord) coordinadoresMap[coord] = true;
    });

    const hojaHistorial = libro.getSheetByName('Historial Directorio');
    let historialReciente = [];

    if (hojaHistorial && hojaHistorial.getLastRow() > 1) {
      const datosHistorial = hojaHistorial.getDataRange().getValues();
      historialReciente = datosHistorial.slice(1)
        .reverse()
        .slice(0, 20)
        .map(fila => ({
          fecha: (fila[0] || '').toString(),
          accion: (fila[1] || '').toString(),
          idDocente: (fila[2] || '').toString(),
          docente: (fila[3] || '').toString(),
          usuario: (fila[4] || '').toString(),
          coordinadorSesion: (fila[5] || '').toString(),
          detalle: (fila[6] || '').toString(),
          estatus: (fila[7] || '').toString(),
          tipoPago1: (fila[8] || '').toString(),
          categoria: (fila[9] || '').toString()
        }));
    }

    docentes.sort((a, b) => {
      const bTs = Math.max(obtenerTimestampTexto_(b.constanciaFecha), obtenerTimestampTexto_(b.fechaActualizacion), obtenerTimestampTexto_(b.fechaCreacion));
      const aTs = Math.max(obtenerTimestampTexto_(a.constanciaFecha), obtenerTimestampTexto_(a.fechaActualizacion), obtenerTimestampTexto_(a.fechaCreacion));
      return bTs - aTs;
    });

    return {
      success: true,
      rol: sesion.rol || '',
      esAdmin: !!sesion.esAdmin,
      docentes: docentes,
      coordinadores: Object.keys(coordinadoresMap).sort(),
      historialReciente: historialReciente,
      resumen: resumen
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}


function obtenerPendientesFiscales(token) {
  try {
    const sesion = validarSesionSegura_(token);
    if (!esUsuarioFinanzas_(sesion)) {
      return { success: false, error: 'Esta vista está disponible para usuarios con rol Admin, Finanzas o Contador.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDirectorio = libro.getSheetByName('Directorio');

    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio".' };
    }

    const mapa = asegurarColumnasDirectorio_(hojaDirectorio);
    const todos = leerDirectorioCompleto_(hojaDirectorio, mapa);

    function evaluar(doc) {
      const estatusActivo = ((doc.estatus || 'ACTIVO').toString().trim().toUpperCase() === 'ACTIVO');
      const tieneRFC = !!(doc.rfc || '').toString().trim();
      const tieneConstancia = !!((doc.constanciaFileId || doc.constanciaUrl || '').toString().trim());
      const tieneBanco = !!(doc.bancoDetalle || '').toString().trim();
      const tieneCorreo = !!(doc.correo || '').toString().trim();
      const tieneTelefono = !!(doc.telefono || '').toString().trim();
      const tieneIdentificador = !!(doc.identificador || '').toString().trim();

      const faltantes = [];
      if (!tieneRFC) faltantes.push('RFC');
      if (!tieneConstancia) faltantes.push('Constancia fiscal');
      if (!tieneBanco) faltantes.push('Banco / cuenta');
      if (!tieneCorreo) faltantes.push('Correo');
      if (!tieneTelefono) faltantes.push('Teléfono');
      if (!tieneIdentificador) faltantes.push('Identificador');

      const porcentaje = Math.round(([tieneRFC, tieneConstancia, tieneBanco, tieneCorreo, tieneTelefono, tieneIdentificador].filter(Boolean).length / 6) * 100);

      let puntajePrioridad = 0;
      if (!tieneConstancia) puntajePrioridad += 35;
      if (!tieneRFC) puntajePrioridad += 30;
      if (!tieneBanco) puntajePrioridad += 20;
      if (!tieneCorreo) puntajePrioridad += 10;
      if (!tieneTelefono) puntajePrioridad += 10;
      if (!tieneIdentificador) puntajePrioridad += 5;
      if (porcentaje < 67) puntajePrioridad += 15;
      else if (porcentaje < 100) puntajePrioridad += 5;

      let prioridad = 'MEDIA';
      if (puntajePrioridad >= 70) prioridad = 'CRITICA';
      else if (puntajePrioridad >= 45) prioridad = 'ALTA';

      return {
        activo: estatusActivo,
        faltantes: faltantes,
        porcentaje: porcentaje,
        prioridad: prioridad,
        puntajePrioridad: puntajePrioridad
      };
    }

    const pendientes = [];
    const coordinadoresMap = {};
    const resumen = {
      totalPendientes: 0,
      criticos: 0,
      altas: 0,
      medias: 0,
      sinConstancia: 0,
      sinRFC: 0,
      sinBanco: 0,
      sinCorreo: 0,
      sinTelefono: 0,
      sinIdentificador: 0
    };

    todos.forEach(doc => {
      const estado = evaluar(doc);
      if (!estado.activo || !estado.faltantes.length) return;

      const enriquecido = {
        filaHoja: doc.filaHoja,
        idDocente: doc.idDocente,
        docente: doc.docente,
        grado: doc.grado,
        tipoPago1: doc.tipoPago1,
        categoria: doc.categoria,
        ubicacion: doc.ubicacion,
        comentario: doc.comentario,
        observacion: doc.observacion,
        coordinador: doc.coordinador,
        telefono: doc.telefono,
        correo: doc.correo,
        rfc: doc.rfc,
        identificador: doc.identificador,
        bancoDetalle: doc.bancoDetalle,
        estatus: doc.estatus,
        constanciaFileId: doc.constanciaFileId,
        constanciaUrl: doc.constanciaUrl,
        constanciaNombre: doc.constanciaNombre,
        constanciaFecha: doc.constanciaFecha,
        fechaCreacion: doc.fechaCreacion,
        fechaActualizacion: doc.fechaActualizacion,
        prioridad: estado.prioridad,
        puntajePrioridad: estado.puntajePrioridad,
        porcentajeExpediente: estado.porcentaje,
        faltantes: estado.faltantes
      };

      pendientes.push(enriquecido);
      resumen.totalPendientes++;

      if (estado.prioridad === 'CRITICA') resumen.criticos++;
      else if (estado.prioridad === 'ALTA') resumen.altas++;
      else resumen.medias++;

      if (!doc.constanciaFileId && !doc.constanciaUrl) resumen.sinConstancia++;
      if (!(doc.rfc || '').toString().trim()) resumen.sinRFC++;
      if (!(doc.bancoDetalle || '').toString().trim()) resumen.sinBanco++;
      if (!(doc.correo || '').toString().trim()) resumen.sinCorreo++;
      if (!(doc.telefono || '').toString().trim()) resumen.sinTelefono++;
      if (!(doc.identificador || '').toString().trim()) resumen.sinIdentificador++;

      if (doc.coordinador) coordinadoresMap[doc.coordinador] = true;
    });

    pendientes.sort(function(a, b) {
      if ((b.puntajePrioridad || 0) !== (a.puntajePrioridad || 0)) {
        return (b.puntajePrioridad || 0) - (a.puntajePrioridad || 0);
      }
      if ((a.porcentajeExpediente || 0) !== (b.porcentajeExpediente || 0)) {
        return (a.porcentajeExpediente || 0) - (b.porcentajeExpediente || 0);
      }
      return (a.docente || '').localeCompare((b.docente || ''), 'es', { sensitivity: 'base' });
    });

    return {
      success: true,
      rol: sesion.rol || '',
      esAdmin: !!sesion.esAdmin,
      docentes: pendientes,
      coordinadores: Object.keys(coordinadoresMap).sort(),
      resumen: resumen
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function guardarDocente(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDirectorio = libro.getSheetByName('Directorio');

    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio". Revisa el nombre.' };
    }

    const mapa = asegurarColumnasDirectorio_(hojaDirectorio);
    const registros = leerDirectorioCompleto_(hojaDirectorio, mapa);

    const modo = ((datos.modo || 'crear').toString().trim().toLowerCase() === 'editar') ? 'editar' : 'crear';
    const filaEditar = parseInt(datos.filaHoja, 10) || null;
    const existente = (modo === 'editar' && filaEditar)
      ? registros.find(r => r.filaHoja === filaEditar)
      : null;

    if (modo === 'editar' && !existente) {
      return { success: false, error: 'No se encontró el docente que intentas editar.' };
    }

    const nombres = normalizarTextoDocenteServidor_(datos.nombres);
    const apellidoPaterno = normalizarTextoDocenteServidor_(datos.apellidoPaterno);
    const apellidoMaterno = normalizarTextoDocenteServidor_(datos.apellidoMaterno);
    const nombreCompleto = [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' ');

    if (!nombres || !apellidoPaterno) {
      return { success: false, error: 'Debes capturar al menos Nombre(s) y Apellido paterno.' };
    }

    if (!nombreCompleto) {
      return { success: false, error: 'El nombre del docente es obligatorio.' };
    }

    const categoria = normalizarTextoDocenteServidor_(datos.categoria);
    if (!['V', 'M', 'N'].includes(categoria)) {
      return { success: false, error: 'La categoría del docente no es válida.' };
    }

    const tipoPago1 = (datos.tipoPago1 || '').toString().trim().toUpperCase();
    if (!['E', '1', '2'].includes(tipoPago1)) {
      return { success: false, error: 'El tipo de pago no es válido.' };
    }

    const grado = normalizarTextoLibre_(datos.grado, 60);
    const ubicacion = normalizarTextoLibre_(datos.tipoPago2 || datos.ubicacion, 40) || 'Local';
    const comentario = normalizarTextoLibre_(datos.comentario, 120);
    const observacion = normalizarTextoLibre_(datos.observacion, 250);
    const telefono = normalizarTelefonoDocente_(datos.telefono);
    const correo = normalizarCorreoDocente_(datos.correo);
    const rfc = normalizarRFCDocente_(datos.rfc);
    const identificador = normalizarTextoLibre_(datos.identificador, 50).toUpperCase();
    const bancoDetalle = normalizarTextoLibre_(datos.bancoDetalle, 120);
    const estatus = normalizarTextoDocenteServidor_(datos.estatus || 'ACTIVO');

    if (telefono && !/^\+?[0-9]{10,15}$/.test(telefono)) {
      return { success: false, error: 'El teléfono debe contener entre 10 y 15 dígitos.' };
    }

    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return { success: false, error: 'El correo electrónico no tiene un formato válido.' };
    }

    if (rfc && !/^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) {
      return { success: false, error: 'El RFC no tiene un formato válido.' };
    }

    if (!['ACTIVO', 'INACTIVO'].includes(estatus)) {
      return { success: false, error: 'El estatus debe ser ACTIVO o INACTIVO.' };
    }

    const coincidencias = obtenerCoincidenciasDocente_(registros, nombreCompleto, existente ? existente.filaHoja : null);
    if (coincidencias.exacta) {
      return {
        success: false,
        error: `Ya existe un docente con ese nombre normalizado: ${coincidencias.exacta.docente}.`
      };
    }

    const ahoraTexto = generarFechaHoraTexto_(new Date());
    const filaDestino = existente ? existente.filaHoja : (hojaDirectorio.getLastRow() + 1);
    const columnasTotales = hojaDirectorio.getLastColumn();
    const filaBase = existente
      ? hojaDirectorio.getRange(filaDestino, 1, 1, columnasTotales).getValues()[0]
      : new Array(columnasTotales).fill('');

    const idx = nombre => indiceDirectorio_(mapa, nombre);
    const set = (nombre, valor) => {
      const pos = idx(nombre);
      if (pos >= 0) filaBase[pos] = valor;
    };

    const idDocente = existente ? existente.idDocente : Utilities.getUuid();
    const coordinadorBase = existente
      ? (existente.coordinador || sesion.nombre || '')
      : (sesion.nombre || '');
    const creadoPorBase = existente
      ? (existente.creadoPor || sesion.usuario || '')
      : (sesion.usuario || '');
    const fechaCreacionBase = existente
      ? (existente.fechaCreacion || ahoraTexto)
      : ahoraTexto;

    set('DOCENTE', nombreCompleto);
    set('GRADO', grado);
    set('TIPO DE PAGO', tipoPago1);
    set('CATEGORIA', categoria);
    set('COMENTARIO', comentario);
    set('UBICACION', ubicacion);
    set('OBSERVACION', observacion);
    set('COORDINADOR', coordinadorBase);
    set('TELEFONO', telefono);
    set('CORREO', correo);
    set('RFC', rfc);
    set('IDENTIFICADOR', identificador);
    set('BANCO DETALLE', bancoDetalle);
    set('ESTATUS', estatus);
    set('NOMBRE NORMALIZADO', normalizarNombreComparable_(nombreCompleto));
    set('NOMBRES', nombres);
    set('APELLIDO PATERNO', apellidoPaterno);
    set('APELLIDO MATERNO', apellidoMaterno);
    set('ID DOCENTE', idDocente);
    set('FECHA CREACION', fechaCreacionBase);
    set('CREADO POR', creadoPorBase);
    set('FECHA ACTUALIZACION', ahoraTexto);
    set('ACTUALIZADO POR', sesion.usuario || '');

    hojaDirectorio.getRange(filaDestino, 1, 1, filaBase.length).setValues([filaBase]);

    const sincronizacionNombre = existente
      ? sincronizarNombreDocenteRelacionado_(libro, existente.docente || '', nombreCompleto)
      : { horarios: 0, extras: 0, total: 0 };

    const despues = {
      filaHoja: filaDestino,
      idDocente: idDocente,
      docente: nombreCompleto,
      grado: grado,
      tipoPago1: tipoPago1,
      categoria: categoria,
      ubicacion: ubicacion,
      comentario: comentario,
      observacion: observacion,
      coordinador: coordinadorBase,
      telefono: telefono,
      correo: correo,
      rfc: rfc,
      identificador: identificador,
      bancoDetalle: bancoDetalle,
      estatus: estatus,
      constanciaFileId: existente ? (existente.constanciaFileId || '') : '',
      constanciaUrl: existente ? (existente.constanciaUrl || '') : '',
      constanciaNombre: existente ? (existente.constanciaNombre || '') : '',
      constanciaFecha: existente ? (existente.constanciaFecha || '') : '',
      constanciaActualizadaPor: existente ? (existente.constanciaActualizadaPor || '') : '',
      nombres: nombres,
      apellidoPaterno: apellidoPaterno,
      apellidoMaterno: apellidoMaterno,
      fechaCreacion: fechaCreacionBase,
      creadoPor: creadoPorBase,
      fechaActualizacion: ahoraTexto,
      actualizadoPor: sesion.usuario || ''
    };

    registrarHistorialDirectorio_(libro, existente ? 'EDICION' : 'ALTA', sesion, existente || null, despues);

    let mensajeRespuesta = existente ? 'Docente actualizado correctamente' : 'Docente registrado correctamente';
    if (sincronizacionNombre.total > 0) {
      mensajeRespuesta += ` · Nombre sincronizado en Horarios: ${sincronizacionNombre.horarios}, Extras: ${sincronizacionNombre.extras}.`;
    }

    return {
      success: true,
      message: mensajeRespuesta,
      docente: despues,
      sincronizacionNombre: sincronizacionNombre,
      coincidenciasSimilares: coincidencias.similares
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


function subirConstanciaFiscal(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const filaHoja = parseInt(datos && datos.filaHoja, 10) || 0;
    if (!filaHoja) {
      return { success: false, error: 'Primero guarda el docente y luego carga la constancia.' };
    }

    const nombreOriginal = (datos && datos.fileName || '').toString().trim();
    const mimeType = (datos && datos.mimeType || '').toString().trim().toLowerCase();
    const base64Data = (datos && datos.base64Data || '').toString().trim();

    if (!nombreOriginal || !mimeType || !base64Data) {
      return { success: false, error: 'No se recibió correctamente el archivo de la constancia.' };
    }

    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)) {
      return { success: false, error: 'La constancia debe estar en formato PDF, JPG o PNG.' };
    }

    const bytes = Utilities.base64Decode(base64Data);
    const tamanioMaximo = 7.5 * 1024 * 1024;
    if (bytes.length > tamanioMaximo) {
      return { success: false, error: 'La constancia excede el tamaño máximo permitido de 7.5 MB.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDirectorio = libro.getSheetByName('Directorio');
    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio".' };
    }

    const mapa = asegurarColumnasDirectorio_(hojaDirectorio);
    const registros = leerDirectorioCompleto_(hojaDirectorio, mapa);
    const docente = registros.find(r => r.filaHoja === filaHoja);

    if (!docente) {
      return { success: false, error: 'No se encontró el docente para asociar la constancia.' };
    }

    const extension = obtenerExtensionArchivo_(nombreOriginal, mimeType);
    if (!extension) {
      return { success: false, error: 'La constancia debe tener una extensión válida (.pdf, .jpg, .jpeg o .png).' };
    }

    const carpeta = obtenerOCrearCarpetaConstancias_();
    const timestampArchivo = Utilities.formatDate(new Date(), obtenerTimezone_(), 'yyyyMMdd_HHmmss');
    const nombreBase = sanitizarNombreArchivo_(docente.docente || 'DOCENTE');
    const nombreArchivo = `CONSTANCIA FISCAL - ${nombreBase} - ${timestampArchivo}${extension}`;
    const blob = Utilities.newBlob(bytes, mimeType, nombreArchivo);
    const archivo = carpeta.createFile(blob);

    archivo.setDescription(`Constancia fiscal de ${docente.docente || ''} · Actualizada por ${sesion.usuario || ''} el ${generarFechaHoraTexto_(new Date())}`);

    if (docente.constanciaFileId) {
      try {
        const anterior = DriveApp.getFileById(docente.constanciaFileId);
        anterior.setTrashed(true);
      } catch (e) {}
    }

    const ahoraTexto = generarFechaHoraTexto_(new Date());
    const columnasTotales = hojaDirectorio.getLastColumn();
    const filaBase = hojaDirectorio.getRange(filaHoja, 1, 1, columnasTotales).getValues()[0];
    const idx = nombre => indiceDirectorio_(mapa, nombre);
    const set = (nombre, valor) => {
      const pos = idx(nombre);
      if (pos >= 0) filaBase[pos] = valor;
    };

    set('CONSTANCIA FILE ID', archivo.getId());
    set('CONSTANCIA URL', archivo.getUrl());
    set('CONSTANCIA NOMBRE', nombreArchivo);
    set('CONSTANCIA FECHA', ahoraTexto);
    set('CONSTANCIA ACTUALIZADA POR', sesion.usuario || '');
    set('FECHA ACTUALIZACION', ahoraTexto);
    set('ACTUALIZADO POR', sesion.usuario || '');

    hojaDirectorio.getRange(filaHoja, 1, 1, filaBase.length).setValues([filaBase]);

    const despues = {
      ...docente,
      constanciaFileId: archivo.getId(),
      constanciaUrl: archivo.getUrl(),
      constanciaNombre: nombreArchivo,
      constanciaFecha: ahoraTexto,
      constanciaActualizadaPor: sesion.usuario || '',
      fechaActualizacion: ahoraTexto,
      actualizadoPor: sesion.usuario || ''
    };

    registrarMovimientoDirectorio_(
      libro,
      docente.constanciaFileId ? 'CONSTANCIA REEMPLAZADA' : 'CONSTANCIA CARGADA',
      sesion,
      despues,
      `Constancia fiscal ${docente.constanciaFileId ? 'reemplazada' : 'cargada'}: ${nombreArchivo}`
    );

    return {
      success: true,
      message: docente.constanciaFileId ? 'Constancia fiscal reemplazada correctamente.' : 'Constancia fiscal cargada correctamente.',
      constancia: {
        fileId: archivo.getId(),
        url: archivo.getUrl(),
        nombre: nombreArchivo,
        fecha: ahoraTexto,
        actualizadoPor: sesion.usuario || ''
      }
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


//Fase 4


// --- FUNCIONES PARA FASE 4: HORARIOS (CON CONTROL DE HORAS - COLUMNA D) ---


function obtenerListasParaHorarios(token, vistaSolicitada) {
  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const metaVista = obtenerMetadatosVistaHorarios_(libro, vistaSolicitada);

    const hojaAsig = libro.getSheetByName('Lista_Combinada');
    const asignaturas = hojaAsig ? hojaAsig.getRange('A2:A').getValues().flat().filter(String) : [];

    const hojaDoc = libro.getSheetByName('Directorio');
    const hojaTab = libro.getSheetByName('Tabulador');
    const tabDatos = hojaTab ? hojaTab.getRange('A2:B').getValues().filter(function(r) { return r[0]; }) : [];
    const tabuladores = tabDatos.map(function(r) { return { nombre: r[0], monto: r[1] }; });

    if (!metaVista.hoja || !hojaDoc || !hojaTab) {
      return { success: false, error: 'Faltan hojas base para Capturar Horarios.' };
    }

    const lectura = construirCargaYHorariosDesdeHoja_(metaVista.hoja);
    const docentesInfo = construirDocentesInfoDesdeCarga_(hojaDoc, lectura.cargaPorDocente);

    const accesoCaptura = obtenerAccesoCapturaPorModulo_(sesion, 'incidencias', libro);
    const cfgCalendario = metaVista.cfg;
    const cicloDestinoHorarios = {
      habilitado: !!cfgCalendario.horariosDestinoHabilitado,
      activo: !!(cfgCalendario.horariosDestinoHabilitado && cfgCalendario.horariosDestinoPeriodo && cfgCalendario.horariosDestinoCuatrimestre),
      periodo: (cfgCalendario.horariosDestinoPeriodo || '').toString().trim(),
      cuatrimestre: (cfgCalendario.horariosDestinoCuatrimestre || '').toString().trim(),
      valido: !!(cfgCalendario.horariosDestinoHabilitado && cfgCalendario.horariosDestinoPeriodo && cfgCalendario.horariosDestinoCuatrimestre),
      periodoOperativo: metaVista.periodoOperativo || '',
      cuatrimestreOperativo: metaVista.cuatrimestreOperativo || ''
    };

    return {
      success: true,
      rol: sesion.rol || '',
      vistaCicloActual: metaVista.vistaActual,
      hojaOrigenActual: metaVista.hojaNombre,
      asignaturas: asignaturas,
      docentesInfo: docentesInfo,
      tabuladores: tabuladores,
      horarios: lectura.horarios.reverse(),
      accesoCaptura: accesoCaptura,
      configuracionCalendario: accesoCaptura.configuracion,
      cicloDestinoHorarios: cicloDestinoHorarios
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function obtenerBaseParaIncidencias(token) {
  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaHorarios = obtenerHojaHorariosOperativa_(libro);
    const accesoCaptura = obtenerAccesoCapturaPorModulo_(sesion, 'incidencias', libro);

    if (!hojaHorarios) {
      return { success: false, error: 'No se encontró la hoja "Horarios Doc".' };
    }

    const lectura = construirCargaYHorariosDesdeHoja_(hojaHorarios);
    return {
      success: true,
      rol: sesion.rol || '',
      horarios: lectura.horarios.reverse(),
      accesoCaptura: accesoCaptura,
      configuracionCalendario: accesoCaptura.configuracion
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}


function guardarHorario(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDoc = libro.getSheetByName('Directorio');
    const hojaTab = libro.getSheetByName('Tabulador');
    const metaVista = obtenerMetadatosVistaHorarios_(libro, datos && datos.vistaCiclo);
    const hojaObjetivo = (datos && datos.filaEditando)
      ? obtenerHojaHorariosPorOrigen_(libro, (datos && datos.hojaOrigen) || '', true)
      : metaVista.hoja;

    if (!hojaObjetivo || !hojaDoc || !hojaTab) {
      return { success: false, error: 'Faltan hojas base.' };
    }

    asegurarColumnasCicloHorarios_(hojaObjetivo);

    const docenteBuscado = normalizarNombreClave_((datos && datos.docente) || '');
    const tabuladorBuscado = ((datos && datos.tabulador) || '').toString().trim();
    const grupoBuscado = ((datos && datos.grupo) || '').toString().trim().toUpperCase();
    const asignaturaBuscada = ((datos && datos.asignatura) || '').toString().trim();

    if (!docenteBuscado || !tabuladorBuscado || !grupoBuscado || !asignaturaBuscada) {
      return { success: false, error: 'Faltan datos obligatorios del horario.' };
    }

    const mapaDir = asegurarColumnasDirectorio_(hojaDoc);
    const docentesDirectorio = leerDirectorioCompleto_(hojaDoc, mapaDir);
    const docenteInfo = docentesDirectorio.find(function(doc) {
      return normalizarNombreClave_(doc.docente) === docenteBuscado;
    });

    if (!docenteInfo) {
      return { success: false, error: 'El docente no existe en Directorio.' };
    }

    if (!esEstatusActivo_(docenteInfo.estatus)) {
      return { success: false, error: 'Solo se pueden capturar horarios para docentes con estatus ACTIVO.' };
    }

    let categoria = (docenteInfo.categoria || 'N').toString().trim().toUpperCase();
    let docenteOficial = docenteInfo.docente || '';

    const datosTab = hojaTab.getRange('A2:B').getValues();
    const tabValido = datosTab.find(function(r) { return (r[0] || '').toString().trim() === tabuladorBuscado; });
    if (!tabValido) {
      return { success: false, error: 'El tabulador seleccionado no existe.' };
    }

    const montoTabulador = parseFloat(tabValido[1]) || 0;
    const montoRecibido = parseFloat((((datos && datos.tabDinero) || '').toString()).replace(/,/g, '')) || 0;
    if (montoTabulador !== montoRecibido) {
      return { success: false, error: 'El monto del tabulador no coincide con la hoja Tabulador.' };
    }

    const maxHoras = (categoria === 'V') ? 35 : ((categoria === 'M') ? 25 : 15);

    const l = parseFloat((datos && datos.l) || 0) || 0;
    const m = parseFloat((datos && datos.m) || 0) || 0;
    const x = parseFloat((datos && datos.x) || 0) || 0;
    const j = parseFloat((datos && datos.j) || 0) || 0;
    const v = parseFloat((datos && datos.v) || 0) || 0;
    const s1 = parseFloat((datos && datos.s1) || 0) || 0;
    const s2 = parseFloat((datos && datos.s2) || 0) || 0;

    const valoresHoras = [l, m, x, j, v, s1, s2];
    if (valoresHoras.some(function(h) { return h < 0; })) {
      return { success: false, error: 'No se permiten horas negativas.' };
    }

    const totalSemanaNuevo = l + m + x + j + v;
    const horasBaseNuevas = totalSemanaNuevo + s1 + s2;

    const datosH = hojaObjetivo.getDataRange().getValues();
    let semanaActual = 0;
    let s1Actual = 0;
    let s2Actual = 0;

    for (let i = 1; i < datosH.length; i++) {
      const filaReal = i + 1;
      if ((datos && datos.filaEditando) && filaReal === datos.filaEditando) continue;

      const docenteFila = normalizarNombreClave_(datosH[i][2]);
      if (docenteFila === docenteBuscado) {
        semanaActual += (parseFloat(datosH[i][6]) || 0)
                      + (parseFloat(datosH[i][7]) || 0)
                      + (parseFloat(datosH[i][8]) || 0)
                      + (parseFloat(datosH[i][9]) || 0)
                      + (parseFloat(datosH[i][10]) || 0);

        s1Actual += parseFloat(datosH[i][11]) || 0;
        s2Actual += parseFloat(datosH[i][12]) || 0;
      }
    }

    const semanaFinal = semanaActual + totalSemanaNuevo;
    const mod1Final = semanaFinal + (s1Actual + s1);
    const mod2Final = semanaFinal + (s2Actual + s2);

    if (semanaFinal > maxHoras) {
      return {
        success: false,
        error: `EXCEDE LÍMITE SEMANAL. El docente ${docenteOficial} (${categoria}) tiene máximo de ${maxHoras}h. Con este registro quedaría en ${semanaFinal}h de L-V.`
      };
    }

    if (mod1Final > maxHoras) {
      return {
        success: false,
        error: `EXCEDE LÍMITE MOD 1. El docente ${docenteOficial} (${categoria}) tiene máximo de ${maxHoras}h. Con este registro quedaría en ${mod1Final}h para Mod 1.`
      };
    }

    if (mod2Final > maxHoras) {
      return {
        success: false,
        error: `EXCEDE LÍMITE MOD 2. El docente ${docenteOficial} (${categoria}) tiene máximo de ${maxHoras}h. Con este registro quedaría en ${mod2Final}h para Mod 2.`
      };
    }

    const nuevaFila = [
      (sesion.nombre || '').toString().trim(),
      asignaturaBuscada,
      docenteOficial,
      grupoBuscado,
      tabuladorBuscado,
      montoTabulador,
      l || '',
      m || '',
      x || '',
      j || '',
      v || '',
      s1 || '',
      s2 || '',
      horasBaseNuevas
    ];

    let cicloAplicado = {
      vista: metaVista.vistaActual,
      hoja: hojaObjetivo.getName(),
      periodo: '',
      cuatrimestre: ''
    };

    if (datos && datos.filaEditando) {
      const filaActual = obtenerFilaRealHorarios_(hojaObjetivo, datos.filaEditando);
      if (!filaActual) {
        return { success: false, error: 'La fila a editar ya no existe.' };
      }
      if (!esFilaEditablePorSesion_(filaActual, sesion)) {
        return { success: false, error: 'No tienes permiso para editar ese registro.' };
      }

      const periodoExistente = (filaActual[17] || '').toString().trim();
      const cuatrimestreExistente = (filaActual[18] || '').toString().trim();
      const periodoFinal = periodoExistente || metaVista.periodo;
      const cuatrimestreFinal = cuatrimestreExistente || metaVista.cuatrimestre;

      if (!periodoFinal || !cuatrimestreFinal) {
        return { success: false, error: 'Configura primero el ciclo correspondiente en Calendario para asignar Periodo y Cuatrimestre al horario.' };
      }

      const filaCompleta = filaActual.slice(0, Math.max(hojaObjetivo.getLastColumn(), 19));
      while (filaCompleta.length < Math.max(hojaObjetivo.getLastColumn(), 19)) filaCompleta.push('');
      for (let i = 0; i < nuevaFila.length; i++) filaCompleta[i] = nuevaFila[i];
      filaCompleta[17] = periodoFinal;
      filaCompleta[18] = cuatrimestreFinal;

      hojaObjetivo.getRange(datos.filaEditando, 1, 1, filaCompleta.length).setValues([filaCompleta]);
      cicloAplicado.periodo = periodoFinal;
      cicloAplicado.cuatrimestre = cuatrimestreFinal;
    } else {
      if (!metaVista.periodo || !metaVista.cuatrimestre) {
        return { success: false, error: 'Configura primero el ciclo operativo o el ciclo destino válido para asignar Periodo y Cuatrimestre al horario.' };
      }

      nuevaFila.push('', '', '', metaVista.periodo, metaVista.cuatrimestre);
      const ultimaFilaReal = Math.max(hojaObjetivo.getLastRow(), 1);
      hojaObjetivo.getRange(ultimaFilaReal + 1, 1, 1, nuevaFila.length).setValues([nuevaFila]);
      cicloAplicado.periodo = metaVista.periodo;
      cicloAplicado.cuatrimestre = metaVista.cuatrimestre;
    }

    if (hojaObjetivo.getName() === HOJA_HORARIOS_OPERATIVA_) {
      actualizarHojaHorasTotales(libro);
    }

    return {
      success: true,
      message: (datos && datos.filaEditando) ? 'Registro actualizado correctamente' : 'Horario registrado correctamente',
      cicloAplicado: cicloAplicado,
      vistaCicloActual: cicloAplicado.vista
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


function eliminarHorario(token, filaObjetivo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const payload = (filaObjetivo && typeof filaObjetivo === 'object') ? filaObjetivo : { fila: filaObjetivo };
    const hojaHorarios = obtenerHojaHorariosPorOrigen_(libro, payload.hojaOrigen || '', false);

    if (!hojaHorarios) {
      return { success: false, error: 'No se encontró la hoja de horarios seleccionada.' };
    }

    const filaNumero = parseInt(payload.fila, 10);
    if (!filaNumero || filaNumero < 2) {
      return { success: false, error: 'La fila del horario a eliminar no es válida.' };
    }

    const filaActual = obtenerFilaRealHorarios_(hojaHorarios, filaNumero);
    if (!filaActual || !String(filaActual[2] || '').trim()) {
      return { success: false, error: 'El registro de horario ya no existe.' };
    }

    if (!esFilaEditablePorSesion_(filaActual, sesion)) {
      return { success: false, error: 'No tienes permiso para eliminar ese registro.' };
    }

    const docente = String(filaActual[2] || '').trim();
    const asignatura = String(filaActual[1] || '').trim();
    const grupo = String(filaActual[3] || '').trim();

    const hojaBitacora = asegurarHojaBitacoraEliminadosHorarios_(libro);
    const registroBitacora = construirRegistroBitacoraEliminadoHorario_(filaActual, filaNumero, sesion);
    registroBitacora[4] = hojaHorarios.getName();
    hojaBitacora.appendRow(registroBitacora);

    hojaHorarios.deleteRow(filaNumero);
    if (hojaHorarios.getName() === HOJA_HORARIOS_OPERATIVA_) {
      actualizarHojaHorasTotales(libro);
    }

    return {
      success: true,
      message: 'Registro eliminado correctamente: ' + [docente, asignatura, grupo].filter(Boolean).join(' · ')
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}

function obtenerEstadoHorasTotales_(valor, maxHoras) {
  if (valor > maxHoras) return 'Excede limite';
  if (valor >= maxHoras) return 'Al limite';
  if (valor >= (maxHoras * 0.8)) return 'Cerca del limite';
  return 'Disponible';
}

function obtenerColoresEstadoHorasTotales_(estado) {
  const mapa = {
    'Disponible': {
      fondo: '#DCFCE7',
      texto: '#166534'
    },
    'Cerca del limite': {
      fondo: '#FEF3C7',
      texto: '#92400E'
    },
    'Al limite': {
      fondo: '#FFEDD5',
      texto: '#C2410C'
    },
    'Excede limite': {
      fondo: '#FEE2E2',
      texto: '#991B1B'
    }
  };

  return mapa[estado] || {
    fondo: '#F3F4F6',
    texto: '#374151'
  };
}

// NUEVA FUNCIÓN: Genera la hoja "Horas Totales"
function actualizarHojaHorasTotales(libro) {
  let hojaTotales = libro.getSheetByName('Horas Totales');
  if (!hojaTotales) {
    hojaTotales = libro.insertSheet('Horas Totales');
  }

  const hojaDoc = libro.getSheetByName('Directorio');
  const hojaHorarios = libro.getSheetByName('Horarios Doc');

  if (!hojaDoc || !hojaHorarios) return;

  const datosDoc = hojaDoc.getRange('A2:D').getValues().filter(r => r[0]);
  const datosH = hojaHorarios.getDataRange().getValues();

  const cargaPorDocente = {};

  for (let i = 1; i < datosH.length; i++) {
    const doc = datosH[i][2];
    if (!doc) continue;

    const l = parseFloat(datosH[i][6]) || 0;
    const m = parseFloat(datosH[i][7]) || 0;
    const x = parseFloat(datosH[i][8]) || 0;
    const j = parseFloat(datosH[i][9]) || 0;
    const v = parseFloat(datosH[i][10]) || 0;
    const s1 = parseFloat(datosH[i][11]) || 0;
    const s2 = parseFloat(datosH[i][12]) || 0;

    if (!cargaPorDocente[doc]) {
      cargaPorDocente[doc] = { semana: 0, s1: 0, s2: 0 };
    }

    cargaPorDocente[doc].semana += (l + m + x + j + v);
    cargaPorDocente[doc].s1 += s1;
    cargaPorDocente[doc].s2 += s2;
  }

  const encabezados = [[
    'Docente',
    'Categoria',
    'TOT SEM',
    'TOT MOD 1',
    'TOT MOD 2',
    'Maximo horas',
    'Estado MOD 1',
    'Estado MOD 2'
  ]];

  hojaTotales.clearContents();
  hojaTotales.clearFormats();

  hojaTotales.getRange(1, 1, 1, encabezados[0].length).setValues(encabezados);
  hojaTotales.getRange('A1:H1')
    .setFontWeight('bold')
    .setBackground('#Dbeafe')
    .setHorizontalAlignment('center');

  const nuevasFilas = [];

  datosDoc.forEach(r => {
    const docente = r[0];
    const cat = r[3] ? r[3].toString().trim().toUpperCase() : 'N';
    const maxHoras = (cat === 'V') ? 35 : ((cat === 'M') ? 25 : 15);

    const semana = cargaPorDocente[docente]?.semana || 0;
    const totalMod1 = semana + (cargaPorDocente[docente]?.s1 || 0);
    const totalMod2 = semana + (cargaPorDocente[docente]?.s2 || 0);

    const estadoMod1 = obtenerEstadoHorasTotales_(totalMod1, maxHoras);
    const estadoMod2 = obtenerEstadoHorasTotales_(totalMod2, maxHoras);

    nuevasFilas.push([
      docente,
      cat,
      semana,
      totalMod1,
      totalMod2,
      maxHoras,
      estadoMod1,
      estadoMod2
    ]);
  });

  if (nuevasFilas.length > 0) {
    hojaTotales.getRange(2, 1, nuevasFilas.length, nuevasFilas[0].length).setValues(nuevasFilas);

    hojaTotales.getRange(2, 3, nuevasFilas.length, 4)
      .setHorizontalAlignment('center');

    hojaTotales.getRange(2, 7, nuevasFilas.length, 2)
      .setHorizontalAlignment('center')
      .setFontWeight('bold');

    const fondosEstados = nuevasFilas.map(fila => {
      const estilo1 = obtenerColoresEstadoHorasTotales_(fila[6]);
      const estilo2 = obtenerColoresEstadoHorasTotales_(fila[7]);
      return [estilo1.fondo, estilo2.fondo];
    });

    const coloresTextoEstados = nuevasFilas.map(fila => {
      const estilo1 = obtenerColoresEstadoHorasTotales_(fila[6]);
      const estilo2 = obtenerColoresEstadoHorasTotales_(fila[7]);
      return [estilo1.texto, estilo2.texto];
    });

    hojaTotales.getRange(2, 7, nuevasFilas.length, 2)
      .setBackgrounds(fondosEstados)
      .setFontColors(coloresTextoEstados);
  }

  hojaTotales.setFrozenRows(1);
  hojaTotales.autoResizeColumns(1, 8);
}

// --- FUNCIONES PARA FASE 5: INCIDENCIAS ---
function guardarIncidenciasFila(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    validarAccesoCapturaPorModulo_(sesion, 'incidencias', libro);
    const hojaHorarios = libro.getSheetByName('Horarios Doc');

    if (!hojaHorarios) return { success: false, error: 'No se encontró la hoja "Horarios Doc".' };

    const filaActual = obtenerFilaRealHorarios_(hojaHorarios, datos.fila);
    if (!filaActual) {
      return { success: false, error: 'La fila indicada no existe.' };
    }

    if (!esFilaEditablePorSesion_(filaActual, sesion)) {
      return { success: false, error: 'No tienes permiso para editar incidencias de ese registro.' };
    }

    const faltas = datos.faltas === '' ? '' : parseFloat(datos.faltas);
    const retardos = datos.retardos === '' ? '' : parseFloat(datos.retardos);
    const extras = datos.extras === '' ? '' : parseFloat(datos.extras);

    const valores = [faltas, retardos, extras].filter(v => v !== '');
    if (valores.some(v => isNaN(v) || v < 0)) {
      return { success: false, error: 'Faltas, retardos y extras deben ser valores numéricos no negativos.' };
    }

    hojaHorarios.getRange(datos.fila, 15).setValue(faltas);
    hojaHorarios.getRange(datos.fila, 16).setValue(retardos);
    hojaHorarios.getRange(datos.fila, 17).setValue(extras);

    return { success: true, message: 'Incidencias guardadas' };
  } catch(e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}

function guardarIncidenciasLote(token, registros) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    validarAccesoCapturaPorModulo_(sesion, 'incidencias', libro);
    const hojaHorarios = libro.getSheetByName('Horarios Doc');

    if (!hojaHorarios) return { success: false, error: 'No se encontró la hoja "Horarios Doc".' };
    if (!Array.isArray(registros) || !registros.length) {
      return { success: false, error: 'No se recibieron filas para guardar.' };
    }

    let guardadas = 0;

    registros.forEach(datos => {
      const filaActual = obtenerFilaRealHorarios_(hojaHorarios, datos.fila);
      if (!filaActual) {
        throw new Error(`La fila ${datos.fila} ya no existe.`);
      }

      if (!esFilaEditablePorSesion_(filaActual, sesion)) {
        throw new Error(`No tienes permiso para editar la fila ${datos.fila}.`);
      }

      const faltas = datos.faltas === '' ? '' : parseFloat(datos.faltas);
      const retardos = datos.retardos === '' ? '' : parseFloat(datos.retardos);
      const extras = datos.extras === '' ? '' : parseFloat(datos.extras);
      const valores = [faltas, retardos, extras].filter(v => v !== '');

      if (valores.some(v => isNaN(v) || v < 0)) {
        throw new Error(`La fila ${datos.fila} contiene valores inválidos. Solo se permiten números no negativos.`);
      }

      hojaHorarios.getRange(datos.fila, 15, 1, 3).setValues([[faltas, retardos, extras]]);
      guardadas++;
    });

    return { success: true, message: `Se guardaron ${guardadas} fila${guardadas === 1 ? '' : 's'} de incidencias.` };
  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


// --- FUNCIONES PARA FASE 6: NÓMINA ---
// --- PROCESADOR DE NÓMINA CON LÓGICA DE CALENDARIO ---

function obtenerDatosNomina(token) {
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaCal = libro.getSheetByName('Calendario');
    const hojaHorarios = libro.getSheetByName('Horarios Doc');
    const hojaExtras = libro.getSheetByName('Extras');
    const hojaDirectorio = libro.getSheetByName('Directorio');

    const sesion = validarSesionSegura_(token);
    const esAdministrador = !!sesion.esAdmin;
    const coordinacionSesion = (sesion.nombre || '').toString().trim();

    function descripcionTipoPago(tipo) {
      if (tipo === 'E') return 'Efectivo';
      if (tipo === '1') return 'Santander';
      if (tipo === '2') return 'Banorte';
      return 'Sin definir';
    }

    function inicializarResumenNomina_(docente, coord, tipoPago, infoDocente, extrasBitacora) {
      const alertas = [];
      const pagoClave = (tipoPago || '').toString().trim().toUpperCase();
      const tieneConstancia = !!((infoDocente && (infoDocente.constanciaFileId || infoDocente.constanciaUrl)) || '').toString().trim();
      const tieneRFC = !!((infoDocente && infoDocente.rfc) || '').toString().trim();
      const tieneBanco = !!((infoDocente && infoDocente.bancoDetalle) || '').toString().trim();

      if (!pagoClave) alertas.push('Tipo de pago sin definir');
      if (!tieneConstancia) alertas.push('Sin constancia fiscal');
      if (!tieneRFC) alertas.push('Sin RFC');
      if (!tieneBanco) alertas.push('Sin banco / cuenta');

      return {
        llave: `${docente}|${coord}`,
        docente: docente,
        coord: coord,
        tipoPago: pagoClave,
        tipoPagoDesc: descripcionTipoPago(pagoClave),
        categoria: (infoDocente && infoDocente.categoria) || '',
        estatus: (infoDocente && infoDocente.estatus) || 'ACTIVO',
        correo: (infoDocente && infoDocente.correo) || '',
        telefono: (infoDocente && infoDocente.telefono) || '',
        rfc: (infoDocente && infoDocente.rfc) || '',
        bancoDetalle: (infoDocente && infoDocente.bancoDetalle) || '',
        constanciaUrl: (infoDocente && infoDocente.constanciaUrl) || '',
        constanciaNombre: (infoDocente && infoDocente.constanciaNombre) || '',
        alertasExpediente: alertas,
        hBase: 0,
        faltas: 0,
        retardos: 0,
        descRet: 0,
        pagoBrutoBase: 0,
        descFaltasMonto: 0,
        descRetMonto: 0,
        descuentosMonto: 0,
        pagoBaseNeto: 0,
        extrasHorarioHoras: 0,
        extrasHorarioMonto: 0,
        extrasBitacoraHoras: (extrasBitacora && extrasBitacora.horas) || 0,
        extrasBitacoraMonto: (extrasBitacora && extrasBitacora.pago) || 0,
        extras: (extrasBitacora && extrasBitacora.horas) || 0,
        extrasMonto: (extrasBitacora && extrasBitacora.pago) || 0,
        pago: (extrasBitacora && extrasBitacora.pago) || 0,
        tabuladoresUsados: []
      };
    }

    function calcularResumenNominaVista_(filas) {
      return (filas || []).reduce(function(acc, row) {
        acc.docentes += 1;
        acc.horasBase += parseFloat(row.hBase) || 0;
        acc.horasExtras += parseFloat(row.extras) || 0;
        acc.pagoBruto += parseFloat(row.pagoBrutoBase) || 0;
        acc.pagoBase += parseFloat(row.pagoBaseNeto) || 0;
        acc.descFaltasMonto += parseFloat(row.descFaltasMonto) || 0;
        acc.descRetMonto += parseFloat(row.descRetMonto) || 0;
        acc.descuentosMonto += parseFloat(row.descuentosMonto) || 0;
        acc.extrasMonto += parseFloat(row.extrasMonto) || 0;
        acc.total += parseFloat(row.pago) || 0;
        return acc;
      }, {
        docentes: 0,
        horasBase: 0,
        horasExtras: 0,
        pagoBruto: 0,
        pagoBase: 0,
        descFaltasMonto: 0,
        descRetMonto: 0,
        descuentosMonto: 0,
        extrasMonto: 0,
        total: 0
      });
    }

    const cfgCalendario = obtenerConfiguracionCalendario_(libro);
    const inicioQ = cfgCalendario._quincenaInicio;
    const finQ = cfgCalendario._quincenaFin;
    const s1Inicio = cfgCalendario._mod1Inicio;
    const s1Fin = cfgCalendario._mod1Fin;
    const s2Inicio = cfgCalendario._mod2Inicio;
    const s2Fin = cfgCalendario._mod2Fin;

    if (!inicioQ || !finQ || !s1Inicio || !s1Fin || !s2Inicio || !s2Fin) {
      return { success: false, error: 'La configuración de la hoja Calendario está incompleta. Revisa quincena, Mod 1 y Mod 2.' };
    }

    const tz = libro.getSpreadsheetTimeZone();
    const ultimaFilaCal = hojaCal.getLastRow();
    const valoresInhabiles = ultimaFilaCal >= 2
      ? hojaCal.getRange(2, 14, ultimaFilaCal - 1, 1).getValues().flat()
      : [];

    const inhabil = valoresInhabiles
      .filter(function(valor) { return valor instanceof Date && !isNaN(valor); })
      .map(function(fecha) { return Utilities.formatDate(fecha, tz, 'yyyy-MM-dd'); });

    let pesos = { L: 0, M: 0, X: 0, J: 0, V: 0, S1: 0, S2: 0 };
    let curr = new Date(inicioQ);
    while (curr <= finQ) {
      const iso = Utilities.formatDate(curr, tz, 'yyyy-MM-dd');
      if (!inhabil.includes(iso)) {
        const d = curr.getDay();
        if (d === 1) pesos.L++;
        if (d === 2) pesos.M++;
        if (d === 3) pesos.X++;
        if (d === 4) pesos.J++;
        if (d === 5) pesos.V++;
        if (d === 6) {
          if (curr >= s1Inicio && curr <= s1Fin) pesos.S1++;
          else if (curr >= s2Inicio && curr <= s2Fin) pesos.S2++;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }

    const mapaDocenteInfo = {};
    const mapaTipoPago = {};
    if (hojaDirectorio) {
      const mapaDir = asegurarColumnasDirectorio_(hojaDirectorio);
      leerDirectorioCompleto_(hojaDirectorio, mapaDir).forEach(function(doc) {
        const nombre = (doc.docente || '').toString().trim();
        if (!nombre) return;
        mapaDocenteInfo[nombre] = doc;
        mapaTipoPago[nombre] = (doc.tipoPago1 || '').toString().trim().toUpperCase();
      });
    }

    let extrasPorDocente = {};
    if (hojaExtras) {
      const dataExtras = hojaExtras.getDataRange().getValues();
      for (let i = 1; i < dataExtras.length; i++) {
        const celdaFecha = dataExtras[i][0];
        const coordExtra = (dataExtras[i][1] || '').toString().trim();
        const docenteExtra = (dataExtras[i][2] || '').toString().trim();
        const horasExtra = parseFloat(dataExtras[i][3]) || 0;
        const tabExtra = parseFloat(dataExtras[i][4]) || 0;
        if (!celdaFecha || !docenteExtra) continue;

        let fechaRegistro;
        if (celdaFecha instanceof Date) {
          fechaRegistro = new Date(celdaFecha);
        } else {
          const partesFecha = celdaFecha.toString().split(' ')[0].split('/');
          fechaRegistro = new Date(partesFecha[2], partesFecha[1] - 1, partesFecha[0]);
        }

        fechaRegistro.setHours(0, 0, 0, 0);
        const inicioCheck = new Date(inicioQ); inicioCheck.setHours(0, 0, 0, 0);
        const finCheck = new Date(finQ); finCheck.setHours(23, 59, 59, 999);

        if (fechaRegistro >= inicioCheck && fechaRegistro <= finCheck) {
          const llaveEx = `${docenteExtra}|${coordExtra}`;
          if (!extrasPorDocente[llaveEx]) extrasPorDocente[llaveEx] = { horas: 0, pago: 0 };
          extrasPorDocente[llaveEx].horas += horasExtra;
          extrasPorDocente[llaveEx].pago += (horasExtra * tabExtra);
        }
      }
    }

    const resumen = {};
    const datosH = hojaHorarios.getDataRange().getValues();
    datosH.shift();

    datosH.forEach(function(f) {
      const coord = (f[0] || '').toString().trim();
      const docente = (f[2] || '').toString().trim();
      const tab = parseFloat(f[5]) || 0;
      if (!docente) return;

      const hL = parseFloat(f[6]) || 0;
      const hM = parseFloat(f[7]) || 0;
      const hX = parseFloat(f[8]) || 0;
      const hJ = parseFloat(f[9]) || 0;
      const hV = parseFloat(f[10]) || 0;
      const hS1 = parseFloat(f[11]) || 0;
      const hS2 = parseFloat(f[12]) || 0;
      const faltasHoras = parseFloat(f[14]) || 0;
      const retardosCant = parseFloat(f[15]) || 0;
      const extrasHorario = parseFloat(f[16]) || 0;

      const hBaseQ = (hL * pesos.L) + (hM * pesos.M) + (hX * pesos.X) + (hJ * pesos.J) + (hV * pesos.V) + (hS1 * pesos.S1) + (hS2 * pesos.S2);
      const descRetardos = retardosCant * 0.5;
      const pagoBrutoBase = hBaseQ * tab;
      const descFaltasMonto = faltasHoras * tab;
      const descRetardosMonto = descRetardos * tab;
      const netoBase = hBaseQ - faltasHoras - descRetardos;
      const pagoBase = netoBase * tab;
      const pagoExtrasHorario = extrasHorario * tab;

      const llave = `${docente}|${coord}`;
      if (!resumen[llave]) {
        const infoDocente = mapaDocenteInfo[docente] || null;
        const tipoPago = mapaTipoPago[docente] || '';
        resumen[llave] = inicializarResumenNomina_(docente, coord, tipoPago, infoDocente, extrasPorDocente[llave]);
        delete extrasPorDocente[llave];
      }

      resumen[llave].hBase += hBaseQ;
      resumen[llave].faltas += faltasHoras;
      resumen[llave].retardos += retardosCant;
      resumen[llave].descRet += descRetardos;
      resumen[llave].pagoBrutoBase += pagoBrutoBase;
      resumen[llave].descFaltasMonto += descFaltasMonto;
      resumen[llave].descRetMonto += descRetardosMonto;
      resumen[llave].descuentosMonto += (descFaltasMonto + descRetardosMonto);
      resumen[llave].pagoBaseNeto += pagoBase;
      resumen[llave].extrasHorarioHoras += extrasHorario;
      resumen[llave].extrasHorarioMonto += pagoExtrasHorario;
      resumen[llave].extras += extrasHorario;
      resumen[llave].extrasMonto += pagoExtrasHorario;
      resumen[llave].pago += pagoBase + pagoExtrasHorario;
      if (tab && resumen[llave].tabuladoresUsados.indexOf(tab) === -1) {
        resumen[llave].tabuladoresUsados.push(tab);
      }
    });

    for (let llaveExtra in extrasPorDocente) {
      const ext = extrasPorDocente[llaveExtra];
      const partes = llaveExtra.split('|');
      const docExtra = partes[0];
      const cooExtra = partes[1];
      const infoDocente = mapaDocenteInfo[docExtra] || null;
      const tipoPago = mapaTipoPago[docExtra] || '';
      if (!resumen[llaveExtra]) {
        resumen[llaveExtra] = inicializarResumenNomina_(docExtra, cooExtra, tipoPago, infoDocente, ext);
      }
    }

    const datosDetalle = Object.values(resumen)
      .map(function(r) {
        r.tipoPagoDesc = descripcionTipoPago(r.tipoPago);
        r.extras = (parseFloat(r.extrasHorarioHoras) || 0) + (parseFloat(r.extrasBitacoraHoras) || 0);
        r.extrasMonto = (parseFloat(r.extrasHorarioMonto) || 0) + (parseFloat(r.extrasBitacoraMonto) || 0);
        r.pago = (parseFloat(r.pagoBaseNeto) || 0) + (parseFloat(r.extrasMonto) || 0);
        r.tabuladoresUsados = (r.tabuladoresUsados || []).sort(function(a, b) { return a - b; });
        return r;
      })
      .sort(function(a, b) {
        const cmp = (a.coord || '').localeCompare((b.coord || ''), 'es', { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return (a.docente || '').localeCompare((b.docente || ''), 'es', { sensitivity: 'base' });
      });

    const dashboardAgrupado = {};
    datosDetalle.forEach(function(r) {
      const docente = (r.docente || '').toString().trim();
      if (!dashboardAgrupado[docente]) {
        dashboardAgrupado[docente] = {
          docente: docente,
          coordinaciones: [],
          tipoPago: r.tipoPago || '',
          tipoPagoDesc: r.tipoPagoDesc || 'Sin definir',
          extras: 0,
          pago: 0
        };
      }
      if (r.coord && dashboardAgrupado[docente].coordinaciones.indexOf(r.coord) === -1) {
        dashboardAgrupado[docente].coordinaciones.push(r.coord);
      }
      dashboardAgrupado[docente].extras += parseFloat(r.extras) || 0;
      dashboardAgrupado[docente].pago += parseFloat(r.pago) || 0;
    });

    const datosDashboard = Object.values(dashboardAgrupado)
      .map(function(r) {
        return {
          docente: r.docente,
          coord: r.coordinaciones.join(', '),
          coordinaciones: r.coordinaciones.join(', '),
          tipoPago: r.tipoPago,
          tipoPagoDesc: r.tipoPagoDesc,
          extras: r.extras,
          pago: r.pago
        };
      })
      .sort(function(a, b) {
        return (a.docente || '').localeCompare((b.docente || ''), 'es', { sensitivity: 'base' });
      });

    const resumenPorTipo = {
      E: { codigo: 'E', nombre: 'Efectivo', total: 0, cantidad: 0 },
      '1': { codigo: '1', nombre: 'Santander', total: 0, cantidad: 0 },
      '2': { codigo: '2', nombre: 'Banorte', total: 0, cantidad: 0 },
      X: { codigo: 'X', nombre: 'Sin definir', total: 0, cantidad: 0 }
    };

    datosDashboard.forEach(function(r) {
      const clave = ['E', '1', '2'].includes(r.tipoPago) ? r.tipoPago : 'X';
      resumenPorTipo[clave].total += parseFloat(r.pago) || 0;
      resumenPorTipo[clave].cantidad += 1;
    });

    const coordinacionesDisponibles = Array.from(new Set(datosDetalle.map(function(r) { return (r.coord || '').toString().trim(); }).filter(Boolean)))
      .sort(function(a, b) { return a.localeCompare(b, 'es', { sensitivity: 'base' }); });

    const nominaVista = esAdministrador
      ? datosDetalle
      : datosDetalle.filter(function(r) { return (r.coord || '').toString().trim() === coordinacionSesion; });

    return {
      success: true,
      datos: datosDetalle,
      datosDashboard: datosDashboard,
      nominaVista: nominaVista,
      resumenNominaVista: calcularResumenNominaVista_(nominaVista),
      coordinacionesDisponibles: coordinacionesDisponibles,
      coordinacionSesion: coordinacionSesion,
      rolSesion: sesion.rol || '',
      resumenPorTipo: resumenPorTipo,
      pesos: pesos,
      periodo: Utilities.formatDate(inicioQ, 'GMT', 'dd/MM') + ' al ' + Utilities.formatDate(finQ, 'GMT', 'dd/MM'),
      esAdmin: esAdministrador
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function obtenerDatosReportesNomina(token) {
  try {
    validarSesionSegura_(token);
    const base = obtenerDatosNomina(token);
    if (!base || !base.success) {
      return base || { success: false, error: 'No fue posible obtener la nómina.' };
    }

    const datos = (Array.isArray(base.datos) ? base.datos : [])
      .map(function(r) {
        return {
          docente: (r.docente || '').toString().trim(),
          coord: (r.coord || '').toString().trim(),
          tipoPago: (r.tipoPago || '').toString().trim(),
          tipoPagoDesc: (r.tipoPagoDesc || '').toString().trim(),
          hBase: parseFloat(r.hBase) || 0,
          faltas: parseFloat(r.faltas) || 0,
          retardos: parseFloat(r.retardos) || 0,
          descRet: parseFloat(r.descRet) || 0,
          extras: parseFloat(r.extras) || 0,
          pago: parseFloat(r.pago) || 0
        };
      })
      .sort(function(a, b) {
        const cmpCoord = (a.coord || '').localeCompare((b.coord || ''), 'es', { sensitivity: 'base' });
        if (cmpCoord !== 0) return cmpCoord;
        return (a.docente || '').localeCompare((b.docente || ''), 'es', { sensitivity: 'base' });
      });

    const coordinaciones = Array.from(new Set(datos.map(function(r) {
      return (r.coord || '').toString().trim();
    }).filter(Boolean))).sort(function(a, b) {
      return a.localeCompare(b, 'es', { sensitivity: 'base' });
    });

    const resumen = datos.reduce(function(acc, r) {
      acc.docentes += 1;
      acc.hBase += parseFloat(r.hBase) || 0;
      acc.faltas += parseFloat(r.faltas) || 0;
      acc.retardos += parseFloat(r.retardos) || 0;
      acc.descRet += parseFloat(r.descRet) || 0;
      acc.extras += parseFloat(r.extras) || 0;
      acc.pago += parseFloat(r.pago) || 0;
      return acc;
    }, { docentes: 0, hBase: 0, faltas: 0, retardos: 0, descRet: 0, extras: 0, pago: 0 });

    return {
      success: true,
      periodo: base.periodo,
      pesos: base.pesos || {},
      coordinaciones: coordinaciones,
      datos: datos,
      resumen: resumen,
      muestraTodasCoordinaciones: true
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

//fase 7
function asegurarHojaExtras_(libro) {
  let hojaExtras = libro.getSheetByName('Extras');
  const encabezados = [
    'FECHA REGISTRO',
    'COORDINADOR',
    'DOCENTE',
    'HORAS',
    'TABULADOR',
    'MOTIVO',
    'FECHA ACTIVIDAD',
    'REFERENCIA',
    'OBSERVACIONES',
    'CAPTURADO POR',
    'FECHA ACTUALIZACION',
    'ACTUALIZADO POR',
    'PERIODO',
    'CUATRIMESTRE'
  ];

  if (!hojaExtras) {
    hojaExtras = libro.insertSheet('Extras');
  }

  if (hojaExtras.getLastRow() === 0) {
    hojaExtras.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
  } else {
    const ultimaCol = Math.max(hojaExtras.getLastColumn(), encabezados.length);
    const fila1 = hojaExtras.getRange(1, 1, 1, ultimaCol).getValues()[0];
    encabezados.forEach(function(enc, idx) {
      if ((fila1[idx] || '').toString().trim() !== enc) {
        hojaExtras.getRange(1, idx + 1).setValue(enc);
      }
    });
  }

  hojaExtras.getRange(1, 1, 1, encabezados.length)
    .setFontWeight('bold')
    .setBackground('#D9EAD3');

  return hojaExtras;
}

function obtenerTabuladoresSugeridosExtras_(libro) {
  const hojaHorarios = libro.getSheetByName('Horarios Doc');
  const mapa = {};

  if (!hojaHorarios || hojaHorarios.getLastRow() <= 1) {
    return mapa;
  }

  const datos = hojaHorarios.getDataRange().getValues();
  for (let i = datos.length - 1; i >= 1; i--) {
    const docente = (datos[i][2] || '').toString().trim();
    const tabulador = parseFloat(datos[i][5]) || 0;
    if (!docente || !tabulador) continue;

    const clave = normalizarNombreClave_(docente);
    if (!mapa[clave]) {
      mapa[clave] = tabulador;
    }
  }

  return mapa;
}


function obtenerMapaCargaHorariaDocentes_(libro) {
  const hojaHorarios = libro.getSheetByName('Horarios Doc');
  const mapa = {};

  if (!hojaHorarios || hojaHorarios.getLastRow() <= 1) {
    return mapa;
  }

  const datos = hojaHorarios.getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    const docente = (datos[i][2] || '').toString().trim();
    if (!docente) continue;

    const l = parseFloat(datos[i][6]) || 0;
    const m = parseFloat(datos[i][7]) || 0;
    const x = parseFloat(datos[i][8]) || 0;
    const j = parseFloat(datos[i][9]) || 0;
    const v = parseFloat(datos[i][10]) || 0;
    const s1 = parseFloat(datos[i][11]) || 0;
    const s2 = parseFloat(datos[i][12]) || 0;
    const semana = l + m + x + j + v;
    const clave = normalizarNombreClave_(docente);

    if (!mapa[clave]) {
      mapa[clave] = { semana: 0, s1: 0, s2: 0 };
    }

    mapa[clave].semana += semana;
    mapa[clave].s1 += s1;
    mapa[clave].s2 += s2;
  }

  return mapa;
}


function obtenerMapaHorasExtrasDocentes_(libro, filaExcluir) {
  const hojaExtras = libro.getSheetByName('Extras');
  const mapa = {};

  if (!hojaExtras || hojaExtras.getLastRow() <= 1) {
    return mapa;
  }

  const totalCols = Math.max(hojaExtras.getLastColumn(), 4);
  const datos = hojaExtras.getRange(2, 1, hojaExtras.getLastRow() - 1, totalCols).getValues();

  for (let i = 0; i < datos.length; i++) {
    const filaHoja = i + 2;
    if (filaExcluir && filaHoja === filaExcluir) continue;

    const docente = (datos[i][2] || '').toString().trim();
    const horas = parseFloat(datos[i][3]) || 0;
    if (!docente || horas <= 0) continue;

    const clave = normalizarNombreClave_(docente);
    mapa[clave] = (parseFloat(mapa[clave]) || 0) + horas;
  }

  return mapa;
}

function obtenerMaxHorasPorCategoria_(categoria) {
  const cat = (categoria || '').toString().trim().toUpperCase();
  if (cat === 'V') return 35;
  if (cat === 'M') return 25;
  return 15;
}

function obtenerEstadoCargaGlobal_(semana, mod1, mod2, maxHoras) {
  function evaluarValor_(valor) {
    if (valor > maxHoras) {
      return {
        clave: 'SOBRECARGA',
        etiqueta: 'Rebasa máximo',
        severidad: 'error'
      };
    }

    if (valor >= maxHoras) {
      return {
        clave: 'AL_LIMITE',
        etiqueta: 'Al límite',
        severidad: 'warning'
      };
    }

    if (valor >= (maxHoras * 0.8)) {
      return {
        clave: 'CERCA',
        etiqueta: 'Cerca del límite',
        severidad: 'warning'
      };
    }

    return {
      clave: 'DISPONIBLE',
      etiqueta: 'Disponible',
      severidad: 'ok'
    };
  }

  const dimensiones = [
    { claveDimension: 'SEMANA', dimensionEtiqueta: 'Semana', valor: parseFloat(semana) || 0 },
    { claveDimension: 'MOD1', dimensionEtiqueta: 'Mod 1', valor: parseFloat(mod1) || 0 },
    { claveDimension: 'MOD2', dimensionEtiqueta: 'Mod 2', valor: parseFloat(mod2) || 0 }
  ];

  const prioridad = {
    DISPONIBLE: 1,
    CERCA: 2,
    AL_LIMITE: 3,
    SOBRECARGA: 4
  };

  let peor = null;

  dimensiones.forEach(function(item) {
    const estado = evaluarValor_(item.valor);
    const actual = {
      clave: estado.clave,
      etiqueta: estado.etiqueta,
      severidad: estado.severidad,
      dimension: item.claveDimension,
      dimensionEtiqueta: item.dimensionEtiqueta,
      valorDimension: item.valor
    };

    if (!peor) {
      peor = actual;
      return;
    }

    const prioridadActual = prioridad[actual.clave] || 0;
    const prioridadPeor = prioridad[peor.clave] || 0;

    if (prioridadActual > prioridadPeor) {
      peor = actual;
      return;
    }

    if (prioridadActual === prioridadPeor && actual.valorDimension > peor.valorDimension) {
      peor = actual;
    }
  });

  return peor || {
    clave: 'DISPONIBLE',
    etiqueta: 'Disponible',
    severidad: 'ok',
    dimension: 'SEMANA',
    dimensionEtiqueta: 'Semana',
    valorDimension: 0
  };
}

function obtenerDatosCapturaExtras(token) {
  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hojaDirectorio = libro.getSheetByName('Directorio');

    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio".' };
    }

    const mapaDir = asegurarColumnasDirectorio_(hojaDirectorio);
    const docentesBase = leerDirectorioCompleto_(hojaDirectorio, mapaDir);
    const tabuladoresSugeridos = obtenerTabuladoresSugeridosExtras_(libro);
    const mapaCargaHoraria = obtenerMapaCargaHorariaDocentes_(libro);
    const hojaExtras = asegurarHojaExtras_(libro);
    const mapaHorasExtras = obtenerMapaHorasExtrasDocentes_(libro);

    const docentes = docentesBase
      .filter(function(doc) {
        return ((doc.estatus || 'ACTIVO').toString().trim().toUpperCase() === 'ACTIVO');
      })
      .map(function(doc) {
        const clave = normalizarNombreClave_(doc.docente);
        const maxHoras = obtenerMaxHorasPorCategoria_(doc.categoria);
        const carga = mapaCargaHoraria[clave] || { semana: 0, s1: 0, s2: 0 };
        const horasExtrasAcumuladas = parseFloat(mapaHorasExtras[clave]) || 0;
        const horasSemanaBase = parseFloat(carga.semana) || 0;
        const horasMod1Base = horasSemanaBase + (parseFloat(carga.s1) || 0);
        const horasMod2Base = horasSemanaBase + (parseFloat(carga.s2) || 0);
        const horasSemanaTotal = horasSemanaBase + horasExtrasAcumuladas;
        const horasMod1Total = horasMod1Base + horasExtrasAcumuladas;
        const horasMod2Total = horasMod2Base + horasExtrasAcumuladas;
        const estadoCarga = obtenerEstadoCargaGlobal_(horasSemanaTotal, horasMod1Total, horasMod2Total, maxHoras);

        return {
          idDocente: doc.idDocente,
          docente: doc.docente,
          categoria: doc.categoria,
          tipoPago1: doc.tipoPago1,
          coordinador: doc.coordinador,
          correo: doc.correo,
          estatus: doc.estatus,
          tabuladorSugerido: tabuladoresSugeridos[clave] || '',
          maxHoras: maxHoras,
          horasExtrasAcumuladas: horasExtrasAcumuladas,
          horasSemanaBase: horasSemanaBase,
          horasMod1Base: horasMod1Base,
          horasMod2Base: horasMod2Base,
          horasSemana: horasSemanaTotal,
          horasMod1: horasMod1Total,
          horasMod2: horasMod2Total,
          estadoCargaClave: estadoCarga.clave,
          estadoCargaEtiqueta: estadoCarga.etiqueta,
          estadoCargaSeveridad: estadoCarga.severidad,
          estadoCargaDimension: estadoCarga.dimension,
          estadoCargaDimensionEtiqueta: estadoCarga.dimensionEtiqueta,
          sobrecargaGlobal: estadoCarga.clave === 'SOBRECARGA',
          cercaLimiteGlobal: estadoCarga.clave === 'CERCA' || estadoCarga.clave === 'AL_LIMITE',
          sobrecargaSemanal: estadoCarga.clave === 'SOBRECARGA',
          cercaLimiteSemanal: estadoCarga.clave === 'CERCA' || estadoCarga.clave === 'AL_LIMITE',
          detalleCarga: 'Base Horarios Doc · Semana ' + horasSemanaBase + '/' + maxHoras + 'h · Mod 1 ' + horasMod1Base + '/' + maxHoras + 'h · Mod 2 ' + horasMod2Base + '/' + maxHoras + 'h · Extras acumuladas ' + horasExtrasAcumuladas + 'h · Total global · Semana ' + horasSemanaTotal + '/' + maxHoras + 'h · Mod 1 ' + horasMod1Total + '/' + maxHoras + 'h · Mod 2 ' + horasMod2Total + '/' + maxHoras + 'h'
        };
      })
      .sort(function(a, b) {
        return (a.docente || '').localeCompare((b.docente || ''), 'es', { sensitivity: 'base' });
      });

    const resumen = {
      totalRegistros: 0,
      totalHoras: 0,
      totalMonto: 0,
      docentesImpactados: 0,
      docentesSobrecarga: docentes.filter(function(doc) { return !!doc.sobrecargaGlobal; }).length
    };
    const registros = [];
    const docentesImpactados = {};

    if (hojaExtras.getLastRow() > 1) {
      const datos = hojaExtras.getRange(2, 1, hojaExtras.getLastRow() - 1, Math.max(hojaExtras.getLastColumn(), 12)).getValues();
      const puedeVerTodo = !!sesion.esAdmin;

      datos.forEach(function(fila, idx) {
        const coordinador = (fila[1] || '').toString().trim();
        const capturadoPor = (fila[9] || '').toString().trim();
        const visible = puedeVerTodo || coordinador === (sesion.nombre || '').toString().trim() || capturadoPor === (sesion.usuario || '').toString().trim();
        if (!visible) return;

        const horas = parseFloat(fila[3]) || 0;
        const tabulador = parseFloat(fila[4]) || 0;
        const total = horas * tabulador;

        registros.push({
          filaHoja: idx + 2,
          fechaRegistro: (fila[0] || '').toString().trim(),
          coordinador: coordinador,
          docente: (fila[2] || '').toString().trim(),
          horas: horas,
          tabulador: tabulador,
          motivo: (fila[5] || '').toString().trim(),
          fechaActividad: (fila[6] || '').toString().trim(),
          fechaActividadIso: ((fila[6] || '').toString().trim() || ''),
          referencia: (fila[7] || '').toString().trim(),
          observaciones: (fila[8] || '').toString().trim(),
          capturadoPor: capturadoPor,
          fechaActualizacion: (fila[10] || '').toString().trim(),
          actualizadoPor: (fila[11] || '').toString().trim(),
          total: total,
          puedeEditar: puedeVerTodo || coordinador === (sesion.nombre || '').toString().trim() || capturadoPor === (sesion.usuario || '').toString().trim()
        });

        resumen.totalRegistros++;
        resumen.totalHoras += horas;
        resumen.totalMonto += total;
        if ((fila[2] || '').toString().trim()) {
          docentesImpactados[(fila[2] || '').toString().trim()] = true;
        }
      });
    }

    registros.sort(function(a, b) {
      return (b.filaHoja || 0) - (a.filaHoja || 0);
    });

    resumen.docentesImpactados = Object.keys(docentesImpactados).length;

    const accesoCaptura = obtenerAccesoCapturaPorModulo_(sesion, 'extras', libro);

    return {
      success: true,
      docentes: docentes,
      registros: registros,
      resumen: resumen,
      rol: sesion.rol || '',
      esAdmin: !!sesion.esAdmin,
      accesoCaptura: accesoCaptura,
      configuracionCalendario: accesoCaptura.configuracion,
      filtrosCargaDisponibles: [
        { valor: 'TODOS', etiqueta: 'Todos los docentes' },
        { valor: 'SOBRECARGA', etiqueta: 'Rebasan máximo global' },
        { valor: 'AL_LIMITE', etiqueta: 'Al límite global' },
        { valor: 'CERCA', etiqueta: 'Cerca del límite global' },
        { valor: 'DISPONIBLE', etiqueta: 'Disponibles' }
      ],
      capturaGlobalExtrasPermitida: true,
      reglaCapturaExtras: 'Cualquier coordinador puede registrar horas extra para cualquier docente activo del Directorio.'
    };
  } catch (e) {
    return responderErrorSeguridad_(e);
  }
}

function guardarExtras(token, datos) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    validarAccesoCapturaPorModulo_(sesion, 'extras', libro);
    const cfgCalendario = obtenerConfiguracionCalendario_(libro);
    const cicloOperativo = obtenerPeriodoCuatrimestreOperativo_(cfgCalendario);
    const hojaDirectorio = libro.getSheetByName('Directorio');
    const hojaExtras = asegurarHojaExtras_(libro);

    if (!hojaDirectorio) {
      return { success: false, error: 'No se encontró la hoja "Directorio".' };
    }

    const mapaDir = asegurarColumnasDirectorio_(hojaDirectorio);
    const docentesBase = leerDirectorioCompleto_(hojaDirectorio, mapaDir);
    const claveDocente = normalizarNombreClave_(datos.docente);
    const docenteInfo = docentesBase.find(function(doc) {
      return normalizarNombreClave_(doc.docente) === claveDocente;
    });

    if (!docenteInfo) {
      return { success: false, error: 'Selecciona un docente válido del Directorio.' };
    }

    if (!esEstatusActivo_(docenteInfo.estatus)) {
      return { success: false, error: 'Solo se pueden capturar horas extra para docentes con estatus ACTIVO.' };
    }

    const horas = parseFloat(datos.horas);
    const tabulador = parseFloat(datos.tabulador);
    const motivo = normalizarTextoLibre_(datos.motivo, 180);
    const referencia = normalizarTextoLibre_(datos.referencia, 120);
    const observaciones = normalizarTextoLibre_(datos.observaciones, 250);
    const fechaActividad = (datos.fechaActividad || '').toString().trim();

    if (isNaN(horas) || horas <= 0) {
      return { success: false, error: 'Las horas extra deben ser mayores a 0.' };
    }
    if (isNaN(tabulador) || tabulador <= 0) {
      return { success: false, error: 'El tabulador extra debe ser mayor a 0.' };
    }
    if (!motivo) {
      return { success: false, error: 'Debes indicar el motivo o actividad.' };
    }
    if (fechaActividad && !/^\d{4}-\d{2}-\d{2}$/.test(fechaActividad)) {
      return { success: false, error: 'La fecha de actividad no es válida.' };
    }

    const filaEditando = parseInt(datos.filaEditando, 10) || null;
    const ahoraTexto = generarFechaHoraTexto_(new Date());
    const mapaCargaHoraria = obtenerMapaCargaHorariaDocentes_(libro);
    const mapaHorasExtras = obtenerMapaHorasExtrasDocentes_(libro, filaEditando);
    const cargaDocente = mapaCargaHoraria[claveDocente] || { semana: 0, s1: 0, s2: 0 };
    const maxHoras = obtenerMaxHorasPorCategoria_(docenteInfo.categoria);
    const horasSemanaBase = parseFloat(cargaDocente.semana) || 0;
    const horasMod1Base = horasSemanaBase + (parseFloat(cargaDocente.s1) || 0);
    const horasMod2Base = horasSemanaBase + (parseFloat(cargaDocente.s2) || 0);
    const horasExtrasPrevias = parseFloat(mapaHorasExtras[claveDocente]) || 0;
    const horasExtrasProyectadas = horasExtrasPrevias + horas;
    const horasSemanaActual = horasSemanaBase + horasExtrasPrevias;
    const horasMod1Actual = horasMod1Base + horasExtrasPrevias;
    const horasMod2Actual = horasMod2Base + horasExtrasPrevias;
    const horasSemanaProyectada = horasSemanaBase + horasExtrasProyectadas;
    const horasMod1Proyectada = horasMod1Base + horasExtrasProyectadas;
    const horasMod2Proyectada = horasMod2Base + horasExtrasProyectadas;
    const estadoCargaActual = obtenerEstadoCargaGlobal_(horasSemanaActual, horasMod1Actual, horasMod2Actual, maxHoras);
    const estadoCargaProyectada = obtenerEstadoCargaGlobal_(horasSemanaProyectada, horasMod1Proyectada, horasMod2Proyectada, maxHoras);
    let alertaSobrecarga = '';

    if (estadoCargaProyectada.clave === 'SOBRECARGA') {
      alertaSobrecarga = 'Alerta: con esta captura, ' + docenteInfo.docente + ' rebasa su máximo permitido en ' + estadoCargaProyectada.dimensionEtiqueta + ' (' + estadoCargaProyectada.valorDimension + '/' + maxHoras + 'h) considerando Horarios Doc + horas extra acumuladas, según su categoría ' + (docenteInfo.categoria || 'N') + '. El extra se guardó porque esta captura es informativa y no bloquea el registro.';
    } else if (estadoCargaProyectada.clave === 'AL_LIMITE' || estadoCargaProyectada.clave === 'CERCA') {
      alertaSobrecarga = 'Aviso: con esta captura, ' + docenteInfo.docente + ' queda ' + estadoCargaProyectada.etiqueta.toLowerCase() + ' en ' + estadoCargaProyectada.dimensionEtiqueta + ' (' + estadoCargaProyectada.valorDimension + '/' + maxHoras + 'h) considerando Horarios Doc + horas extra acumuladas.';
    }

    if (filaEditando) {
      if (filaEditando < 2 || filaEditando > hojaExtras.getLastRow()) {
        return { success: false, error: 'No se encontró el registro de extra que intentas editar.' };
      }

      const filaActual = hojaExtras.getRange(filaEditando, 1, 1, Math.max(hojaExtras.getLastColumn(), 12)).getValues()[0];
      const coordinadorActual = (filaActual[1] || '').toString().trim();
      const capturadoPorActual = (filaActual[9] || '').toString().trim();
      const puedeEditar = !!sesion.esAdmin || coordinadorActual === (sesion.nombre || '').toString().trim() || capturadoPorActual === (sesion.usuario || '').toString().trim();

      if (!puedeEditar) {
        return { success: false, error: 'No tienes permiso para editar este registro de horas extra.' };
      }

      const periodoExistente = (filaActual[12] || '').toString().trim();
      const cuatrimestreExistente = (filaActual[13] || '').toString().trim();
      const periodoFinal = periodoExistente || cicloOperativo.periodo;
      const cuatrimestreFinal = cuatrimestreExistente || cicloOperativo.cuatrimestre;
      if (!periodoFinal || !cuatrimestreFinal) {
        return { success: false, error: 'Configura primero Inicio Mod 1 y Fin Mod 2 en Calendario para asignar Periodo y Cuatrimestre a Extras.' };
      }

      const filaNueva = new Array(Math.max(hojaExtras.getLastColumn(), 14)).fill('');
      filaNueva[0] = (filaActual[0] || ahoraTexto).toString().trim();
      filaNueva[1] = coordinadorActual || (sesion.nombre || '').toString().trim();
      filaNueva[2] = docenteInfo.docente;
      filaNueva[3] = horas;
      filaNueva[4] = tabulador;
      filaNueva[5] = motivo;
      filaNueva[6] = fechaActividad;
      filaNueva[7] = referencia;
      filaNueva[8] = observaciones;
      filaNueva[9] = capturadoPorActual || (sesion.usuario || '').toString().trim();
      filaNueva[10] = ahoraTexto;
      filaNueva[11] = (sesion.usuario || '').toString().trim();
      filaNueva[12] = periodoFinal;
      filaNueva[13] = cuatrimestreFinal;

      hojaExtras.getRange(filaEditando, 1, 1, filaNueva.length).setValues([filaNueva]);

      return {
        success: true,
        mensaje: `Registro actualizado correctamente para ${docenteInfo.docente}.`,
        alerta: alertaSobrecarga,
        docenteCarga: {
          horasSemanaBase: horasSemanaBase,
          horasMod1Base: horasMod1Base,
          horasMod2Base: horasMod2Base,
          horasExtrasPrevias: horasExtrasPrevias,
          horasExtrasProyectadas: horasExtrasProyectadas,
          horasSemanaActual: horasSemanaActual,
          horasMod1Actual: horasMod1Actual,
          horasMod2Actual: horasMod2Actual,
          horasSemanaProyectada: horasSemanaProyectada,
          horasMod1Proyectada: horasMod1Proyectada,
          horasMod2Proyectada: horasMod2Proyectada,
          maxHoras: maxHoras,
          categoria: docenteInfo.categoria || 'N',
          estadoActual: estadoCargaActual.clave,
          estadoProyectado: estadoCargaProyectada.clave,
          dimensionProyectada: estadoCargaProyectada.dimensionEtiqueta
        }
      };
    }

    if (!cicloOperativo.valido) {
      return { success: false, error: 'Configura primero Inicio Mod 1 y Fin Mod 2 en Calendario para asignar Periodo y Cuatrimestre a Extras.' };
    }

    hojaExtras.appendRow([
      ahoraTexto,
      (sesion.nombre || '').toString().trim(),
      docenteInfo.docente,
      horas,
      tabulador,
      motivo,
      fechaActividad,
      referencia,
      observaciones,
      (sesion.usuario || '').toString().trim(),
      ahoraTexto,
      (sesion.usuario || '').toString().trim(),
      cicloOperativo.periodo,
      cicloOperativo.cuatrimestre
    ]);

    return {
      success: true,
      mensaje: `¡Bitácora actualizada! Se registraron ${horas}h extra para ${docenteInfo.docente}.`,
      alerta: alertaSobrecarga,
      docenteCarga: {
        horasSemana: horasSemanaActual,
        maxHoras: maxHoras,
        categoria: docenteInfo.categoria || 'N'
      }
    };

  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}

function obtenerMisDocentes(token) {
  try {
    validarSesionSegura_(token);
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Directorio');
    if (!hoja) return [];

    const data = hoja.getDataRange().getValues();
    let docentes = new Set(); 

    for (let i = 1; i < data.length; i++) {
      let nombreDocente = data[i][0];
      if (nombreDocente && nombreDocente.toString().trim() !== '') {
        docentes.add(nombreDocente.toString().trim()); 
      }
    }

    return Array.from(docentes).sort();
  } catch (e) {
    return [];
  }
}


function guardarNominaGlobalDocente(token, datos, periodo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sesion = validarSesionSegura_(token);
    if (!sesion.esAdmin) {
      return { success: false, error: 'Solo un administrador puede guardar la nómina global.' };
    }

    const libro = SpreadsheetApp.getActiveSpreadsheet();
    let hojaHistorial = libro.getSheetByName('Historial Nómina');

    if (!hojaHistorial) {
      hojaHistorial = libro.insertSheet('Historial Nómina');
      hojaHistorial.appendRow([
        'Fecha de Guardado',
        'Periodo',
        'Docente',
        'Coordinación(es)',
        'Tipo Pago',
        'Descripción Tipo Pago',
        'Horas Extra',
        'Total Pagado'
      ]);
      hojaHistorial.getRange('A1:H1').setFontWeight('bold').setBackground('#d3d3d3');
    }

    const periodoNormalizado = (periodo || '').toString().trim();
    if (!periodoNormalizado) {
      return { success: false, error: 'El periodo es obligatorio para guardar historial.' };
    }

    const ultimaFila = hojaHistorial.getLastRow();
    if (ultimaFila >= 2) {
      const periodosGuardados = hojaHistorial.getRange(2, 2, ultimaFila - 1, 1).getValues().flat()
        .map(p => (p || '').toString().trim());

      if (periodosGuardados.includes(periodoNormalizado)) {
        return {
          success: false,
          error: `La nómina del periodo ${periodoNormalizado} ya fue guardada en Historial Nómina.`
        };
      }
    }

    const fechaActual = Utilities.formatDate(new Date(), obtenerTimezone_(), 'dd/MM/yyyy HH:mm:ss');
    let filasAGuardar = [];

    (datos || []).forEach(f => {
      if ((parseFloat(f.pago) || 0) > 0) {
        filasAGuardar.push([
          fechaActual,
          periodoNormalizado,
          f.docente,
          f.coordinaciones || f.coord || '',
          f.tipoPago || '',
          f.tipoPagoDesc || 'Sin definir',
          parseFloat(f.extras) || 0,
          parseFloat(f.pago) || 0
        ]);
      }
    });

    if (filasAGuardar.length === 0) {
      return { success: false, error: 'No hay registros válidos para guardar en historial.' };
    }

    hojaHistorial.getRange(
      hojaHistorial.getLastRow() + 1,
      1,
      filasAGuardar.length,
      8
    ).setValues(filasAGuardar);

    return {
      success: true,
      mensaje: `¡Se guardó correctamente la nómina agrupada de ${filasAGuardar.length} docentes para el periodo ${periodoNormalizado}!`
    };

  } catch (e) {
    return responderErrorSeguridad_(e);
  } finally {
    lock.releaseLock();
  }
}


function normalizarEncabezadoEstadistica_(texto) {
  return (texto || '')
    .toString()
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


function obtenerDatosEstadisticas(token) {
  try {
    validarSesionSegura_(token);
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName('Historial Nómina');
    
    if (!hoja || hoja.getLastRow() <= 1) {
      return { success: false, error: 'Aún no hay datos guardados en el Historial de Nómina para graficar.' };
    }

    const datos = hoja.getDataRange().getValues();
    const encabezadosOriginales = datos[0].map(h => (h || '').toString().trim());
    const encabezados = encabezadosOriginales.map(normalizarEncabezadoEstadistica_);

    function buscarIndice(posiblesNombres) {
      for (let i = 0; i < encabezados.length; i++) {
        if (posiblesNombres.includes(encabezados[i])) {
          return i;
        }
      }
      return -1;
    }

    const idxPeriodo = buscarIndice([
      'PERIODO',
      'QUINCENA',
      'PERIODO QUINCENAL'
    ]);

    const idxCoordinaciones = buscarIndice([
      'COORDINACION(ES)',
      'COORDINACIONES',
      'COORDINACION',
      'COORDINADOR',
      'COORDINADOR(ES)',
      'COORD'
    ]);

    const idxPago = buscarIndice([
      'TOTAL PAGADO',
      'TOTAL PAGO',
      'TOTAL A PAGAR',
      'PAGO TOTAL',
      'PAGO'
    ]);

    if (idxPeriodo === -1 || idxCoordinaciones === -1 || idxPago === -1) {
      return {
        success: false,
        error:
          'No se pudieron identificar automáticamente las columnas del Historial Nómina. ' +
          'Encabezados detectados: ' + encabezadosOriginales.join(' | ')
      };
    }

    const porPeriodo = {};
    const porCoordinador = {};

    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];

      const periodo = (fila[idxPeriodo] || '').toString().trim();
      const coordinacionesTexto = (fila[idxCoordinaciones] || '').toString().trim();
      const pago = parseFloat(fila[idxPago]) || 0;

      if (!periodo || pago <= 0) continue;

      if (!porPeriodo[periodo]) porPeriodo[periodo] = 0;
      porPeriodo[periodo] += pago;

      let coordinaciones = coordinacionesTexto
        ? coordinacionesTexto.split(',').map(c => c.trim()).filter(Boolean)
        : ['Sin definir'];

      if (coordinaciones.length === 0) {
        coordinaciones = ['Sin definir'];
      }

      const pagoPorCoordinacion = pago / coordinaciones.length;

      coordinaciones.forEach(coord => {
        if (!porCoordinador[coord]) porCoordinador[coord] = 0;
        porCoordinador[coord] += pagoPorCoordinacion;
      });
    }

    const porCoordinadorOrdenado = Object.fromEntries(
      Object.entries(porCoordinador).sort((a, b) => b[1] - a[1])
    );

    return { 
      success: true, 
      porPeriodo: porPeriodo, 
      porCoordinador: porCoordinadorOrdenado,
      notaDistribucion: 'Cuando un registro histórico contiene varias coordinaciones en una sola fila, el total se reparte proporcionalmente entre ellas para la gráfica.'
    };

  } catch (e) {
    return { success: false, error: e.toString() };
  }
}