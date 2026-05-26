# Conciliacion de Nomina Mayo 2026 - H02/H03

## 1. Contexto

Durante las pruebas locales de H02/H03 se comparo el calculo de la quincena vigente contra el total reportado por el programa anterior.

Ambiente usado:

- Rama: `feature/h02-h03-user-coordinations-permissions`
- Base local/revision: `nomina_docente_deploy_snapshot_20260526_111616_h02h03`
- Host local: `localhost:55432`
- Quincena validada: `2026-05-15` a `2026-05-28`
- CSV de Horarios: `NOMINA DOCENTE 26-3 - Horarios Doc (1).csv`
- CSV de Extras: `NOMINA DOCENTE 26-3 - Extras.csv`

Restricciones respetadas:

- No se modifico produccion.
- No se hizo deploy.
- No se modifico H01.
- No se cambio formula de nomina.
- No se cambio precision monetaria.
- No se retiro fallback legacy.
- No se activo modo estricto.

## 2. Resultado de calculo local

Con los CSV cargados en la base local de revision, el calculo del sistema nuevo arrojo:

| Concepto | Resultado |
|---|---:|
| Registros de Horarios | 589 |
| Horas base calculadas para la quincena | 3021.0 |
| Importe bruto por Horarios | `$393,235.00` |
| Faltas | 30.0 |
| Descuento por faltas | `-$4,035.00` |
| Retardos | 0 |
| Descuento por retardos | `$0.00` |
| Extras desde Incidencias | `$0.00` |
| Subtotal Horarios | `$389,200.00` |
| Registros de Extras | 65 |
| Horas extra | 1025.0 |
| Importe de Extras | `$128,310.00` |
| Total calculado por sistema nuevo | `$517,510.00` |

Total reportado por programa anterior:

| Fuente | Total |
|---|---:|
| Sistema nuevo local H02/H03 | `$517,510.00` |
| Programa anterior | `$515,920.00` |
| Diferencia | `$1,590.00` |

## 3. Hallazgo de conciliacion

Se identifico que la diferencia de `$1,590.00` corresponde exactamente a dos registros del CSV de Extras que el programa anterior no contemplo:

| Fila CSV | Coordinacion | Docente | Horas | Tabulador | Importe |
|---:|---|---|---:|---:|---:|
| 50 | Oriana Nah Rosado | LUCIANO COCOM UHH | 12 | `$125.00` | `$1,500.00` |
| 55 | Merit Berenice Bazan Garcia | PEDRO ANTONIO RUIZ MARTINEZ | 0.5 | `$180.00` | `$90.00` |
|  |  | **Total omitido por programa anterior** |  |  | **`$1,590.00`** |

La suma de esos dos registros explica por completo la diferencia:

```text
$1,500.00  LUCIANO COCOM UHH / Oriana Nah Rosado
   +90.00  PEDRO ANTONIO RUIZ MARTINEZ / Merit Berenice Bazan Garcia
---------
 $1,590.00
```

## 4. Conclusion tecnica

La diferencia no fue causada por H02/H03, por la migracion local, ni por la regla nueva de docentes compartidos entre coordinaciones.

El sistema nuevo calculo correctamente el total de acuerdo con los CSV cargados:

```text
$389,200.00  Subtotal Horarios
+128,310.00  Extras CSV
-----------
 $517,510.00  Total calculado
```

El programa anterior quedo subcalculado por `$1,590.00` porque omitio:

- Fila 50 de Extras: `LUCIANO COCOM UHH`.
- Fila 55 de Extras: `PEDRO ANTONIO RUIZ MARTINEZ`.

Por lo tanto, el total conciliado con la fuente CSV actual es:

```text
$517,510.00
```

## 5. Implicacion operativa

Si el CSV de Extras es la fuente autorizada para la segunda quincena de mayo 2026, el monto correcto a pagar es `$517,510.00`.

Si Operacion o Finanzas decide pagar `$515,920.00`, entonces esa diferencia debe documentarse como una exclusion operativa explicita de las filas 50 y 55, no como correccion de formula ni como ajuste de H02/H03.

## 6. Recomendacion

- Conservar este hallazgo como evidencia de conciliacion.
- Validar con Operacion/Finanzas que las filas 50 y 55 deben pagarse.
- No modificar la formula de nomina por esta diferencia.
- No revertir cambios de H02/H03 por este hallazgo.
- Si se requiere auditoria posterior, comparar el detalle por docente del programa anterior contra el CSV de Extras para confirmar que esas filas fueron omitidas.
