# NexClinic: control de almacenamiento — candidata parcial

Fecha: 2026-11-02. Base: `245f21b3`, origin/main de guille6720/DrFlow.
Rama: `codex/nexclinic-storage-reservations`. Copia aislada; las copias previas se preservaron.

## Evidencia observada

- Vercel: `drflow-app`, `prj_pD2TRRiHl51oytlTfqcBmEPxhUl1`.
- Dominios verificados por Vercel: nexclinic.opusorg.com, drflow.opusorg.com,
  drflow-app-rho.vercel.app. Fiscalizacion usa fiscalizacion.nexclinic.opusorg.com
  y fiscalizacion.drflow.opusorg.com, asociados al entorno personalizado
  `env_FmQioQS2lODiuYYT8nOVJPAVNdmM`. La rama productiva efectiva sigue pendiente de verificar.
- Supabase: DrFlow `nipqdarduknydqptqzup`, DrFlow-Staging `gprmsufvhabntbrytwyi`;
  Fiscalizacion `lbfzxpweuunmhdpnbspb`, Recovery-Test `djhnxrlmmtbhwitqudrl`.
  La asignación de variables Vercel a estas bases aún debe verificarse.
- Consultas exclusivamente de catálogo, definiciones de políticas y buckets. Sin lectura de registros clínicos.
- En producción y staging, clinical-files es privado, máximo por archivo 10485760 bytes.
- Catálogo productivo consultado directamente: basic 500 MB, essential 5120 MB,
  premium 20000 MB, pro 25600 MB; trial, enterprise y legacy tienen valor null.
  Esto describe el catálogo, no confirma derechos efectivos individuales ni contratos.
- Ambos entornos tienen get_clinic_entitlements(uuid). No se ejecutó: la definición
  local de la migración 128 puede escribir vencimientos incluso al consultar.
- INSERT y DELETE en storage.objects permiten authenticated con can_write_clinical_storage(name).
  SELECT usa can_read_clinical_storage(name). La definición efectiva de esos helpers queda pendiente.

## Inventario inicial del código actual

Ocho emisores de upload, todos encontrados en src:

| Archivo | Función/ruta |
| --- | --- |
| src/features/pacientes/actions/patient-attachments.ts | adjuntos de paciente |
| src/lib/actions/admin-documents.ts | documentos administrativos |
| src/lib/actions/professional-signatures.ts | firmas profesionales |
| src/lib/server/process-clinical-pdf-import.ts | importación PDF clínica |
| src/lib/server/import-staging.ts | archivo temporal de importación |
| src/lib/server/export-staging.ts | exportación persistida y URL firmada |
| src/features/integraciones/server/hce-import-batch.ts | importación HCE CSV |
| src/features/integraciones/actions/historical-documents-import.ts | documentos históricos |

Lecturas: import-staging, pack-clinical-export-zip y patient-ehr-from-hce;
export-staging firma enlaces de descarga. Deletes y compensaciones aparecen también
en clinical-reset y purge-sole-owner-clinics. Hay que centralizarlos para conciliar bajas.
La búsqueda inicial no encontró S3Client ni createSignedUploadUrl en src; no certifica ausencia fuera de src.

El procesador src/core/jobs/process.ts crea un cliente service_role y procesa
importaciones y exportaciones. bulk-clinical-export puede usar cliente privilegiado para firmar.
Vercel programa /api/jobs/process cada minuto, health cada hora y observability/purge diariamente.
Falta completar el inventario de scripts, integraciones externas y consumidores privilegiados.

storage.server.ts suma patient_attachments y patient_admin_documents, con fallback
limitado a 8000 filas. Si solo una consulta falla devuelve un total parcial. La consulta
y la subida son independientes: dos cargas concurrentes pueden aprobar el mismo saldo.
Importaciones temporales, exportaciones y firmas no quedan cubiertas por esa suma.

## Implementado en esta candidata

verified-storage.ts define el protocolo de orquestación con puertos inyectables.
Autoriza incluso reintentos completados, copia los bytes antes del primer await,
calcula SHA256, compara identidad completa de reserva, verifica tamaño y SHA256
descargados, recupera una respuesta de upload perdida y conserva estados inciertos.
Un reintento incierto solo concilia: no sobrescribe. No existe liberación por tiempo.

El módulo aún no está conectado a las rutas de producción. Los puertos no son una
implementación de autorización, persistencia atómica ni exclusión de escritores simultáneos.
Los 11 tests unitarios pasan; no prueban PostgreSQL ni políticas RLS.

## Diseño pendiente antes de activación

1. Ledger privado con RLS, sin acceso directo de anon/authenticated. Una fila por clínica
   bloqueada en la reserva; identidad única clínica/clave y bucket/path. El servidor deriva
   clínica y permisos de sesión vigente o contexto de job autorizado, nunca del cuerpo cliente.
2. Resolver derechos reales en la misma transacción: planes, overrides temporales,
   adicionales y contratos; conservar null ilimitado, sin convertirlo a cero. Coordinar
   cambios comerciales con el mismo bloqueo. No reutilizar una RPC que escriba vencimientos
   desde una operación que se presenta como lectura. No modificar precios ni suscripciones.
3. Inventariar bytes físicos por bucket/path mediante metadatos antes de habilitar cuotas.
   Contar objetos existentes una sola vez, incluyendo huérfanos, temporales y exportaciones.
   Separar el contador mensual antiguo del saldo físico; aún falta auditar sus consumidores.
4. Reservar antes de enviar y conservar capacidad hasta verificar o demostrar ausencia
   después de que ningún escritor pueda completar. Un 404 aislado o antigüedad no bastan.
   Completar y conciliar deben ser idempotentes; un cambio de plan no invalida reservas admitidas.
5. Incorporar las ocho rutas, baja física confirmada, jobs y clientes privilegiados.
   No cerrar políticas de escritura mientras alguna ruta autorizada dependa de ellas.
6. Compatibilidad: desplegar primero servidor compatible con sesiones existentes,
   probar sesiones anteriores y pestañas abiertas, y después cerrar bypass de Storage.
   Las cargas antiguas directas requieren estrategia explícita de transición.
7. Exportaciones automáticas necesitan presupuesto temporal explícito o descarga directa;
   no deben borrar archivos clínicos ni exceder una cuota implícitamente.

## Validación y límites

Docker está instalado pero no hay motor accesible; PostgreSQL local no fue iniciado.
Supabase staging sí responde SQL, pero no se aplicó DDL ni se insertaron fixtures allí.
Faltan pruebas PostgreSQL reales de concurrencia, roles ficticios, RLS, rollback,
idempotencia entre procesos, cambios de plan y estados inciertos. Falta QA autenticado
de app y verificación de la candidata con base aislada. No hay certificación de seguridad integral.

## Rollback

Esta candidata agrega un módulo sin consumidores y pruebas: revertir su commit basta.
No se aplicaron migraciones ni cambios remotos de datos o políticas. Para la futura
activación, conservar ledger y reservas inciertas; desactivar el ingreso nuevo mediante
configuración controlada y continuar conciliación. No volver automáticamente a políticas
permisivas ni borrar tablas/reservas para restaurar disponibilidad.

## Continuación con Docker

Docker Engine 29.7.2 accesible mediante permisos del usuario. Se creó exclusivamente
el contenedor local nexclinic-storage-test-20261102, PostgreSQL 17 Alpine, puerto
127.0.0.1:55439. Usa autenticación trust para fixtures desechables; no usar para datos
reales ni exponer a la red. No se montaron directorios ni credenciales reales.

supabase/tests/storage-reservation-candidate.sql es un prototipo SQL de pruebas,
fuera del directorio de migraciones: no se aplica al desplegar. No es todavía una
migración Supabase ni sincroniza el catálogo comercial real. Su saldo inicial y límite
son fixtures explícitos. Bloquea una cuenta por clínica, serializa las reservas y
actualizaciones del límite, conserva incertidumbres y no ofrece liberación por edad.
El esquema privado, las tablas con RLS y la revocación de funciones a PUBLIC impiden
acceso directo. Las funciones son SECURITY INVOKER; los tests operan como postgres.
Esto no sustituye pruebas con identidades Supabase, service_role, Auth y Storage reales.

Pruebas locales reproducibles: crear una base vacía con nombre storage_test_<sufijo>
en ese contenedor y ejecutar node scripts/test-storage-postgres.mjs <nombre_base>.
El script solo acepta ese prefijo y usa 127.0.0.1:55439; rechaza un esquema existente.
La primera ejecución aprobó 20 reservas concurrentes (10 admitidas), 12 reintentos
idénticos, conflictos de hash, incertidumbre retenida, integridad, finalización
idempotente, reducción de límite, ilimitados, inventario faltante y roles ficticios.
La ejecución final en storage_test_final pasó además reducción concurrente del límite,
tamaño inválido y ruta de otra clínica. ESLint focalizado y las 11 pruebas unitarias
del protocolo volvieron a pasar. Una ejecución intermedia detectó colisión de roles
entre bases del mismo clúster: se corrigió usando roles con prefijo por base.
No hay jobs ni puertos de app conectados a este prototipo. Las migraciones aditivas,
el cierre de bypass y el QA de app siguen pendientes; Docker dejó de ser bloqueo.

Estado: base de implementación revisable, no candidata de activación. No fusionar ni
promover como control completo de cuotas hasta resolver los pendientes anteriores.
