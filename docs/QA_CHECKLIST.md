# Checklist QA — DrFlow MVP

## Autenticación y roles

- [ ] Login con credenciales válidas redirige a `/dashboard`
- [ ] Login con credenciales inválidas muestra error humano
- [ ] Registro de clínica crea `clinics`, `profiles`, `clinic_members`
- [ ] Usuario multi-clínica ve selector y cambia clínica activa
- [ ] Rutas protegidas redirigen a `/login` sin sesión
- [ ] Secretaria no accede a `/configuracion`
- [ ] Paciente no accede a `/historias` (si aplica rol patient)
- [ ] Superadmin ve todas las clínicas

## Dashboard

- [ ] KPIs muestran 0 en estado vacío sin errores
- [ ] Próximos turnos listan correctamente
- [ ] Accesos rápidos navegan a módulos correctos
- [ ] Responsive en mobile (320px+) y tablet

## Agenda

- [ ] Crear turno con datos válidos
- [ ] Error al superponer turnos del mismo profesional
- [ ] Confirmar / atender / cancelar cambia estado
- [ ] Filtros por médico y especialidad funcionan
- [ ] Vista semanal muestra turnos por día
- [ ] Estado vacío con CTA visible

## Pacientes

- [ ] CRUD: crear, listar, ver ficha
- [ ] Búsqueda por nombre y DNI
- [ ] Validación de campos requeridos
- [ ] Historial de turnos y consultas en ficha
- [ ] Usuario clínica A no ve pacientes clínica B

## Historia clínica

- [ ] Crear consulta con plantilla
- [ ] Auditoría registra creación
- [ ] Export PDF genera archivo descargable
- [ ] Aviso legal visible en borrador prescripción
- [ ] Solo médico/admin edita registros clínicos

## Recordatorios

- [ ] Envío simulado email/WhatsApp crea log
- [ ] Log muestra destinatario, canal, estado, fecha
- [ ] Error si paciente sin contacto para canal

## Telemedicina

- [ ] Crear sala genera URL Jitsi
- [ ] Sesión asociada al turno
- [ ] Link abre en nueva pestaña

## Pagos

- [ ] Mock pago registra transacción con estado `paid`
- [ ] Historial muestra monto, seña, estado
- [ ] Solo roles autorizados acceden

## Reportes

- [ ] Métricas del mes actual
- [ ] Consultas por médico
- [ ] Export CSV descarga archivo válido

## Configuración

- [ ] Muestra datos de clínica activa
- [ ] Lista especialidades, sedes, profesionales, usuarios
- [ ] Solo admin accede

## Seguridad transversal

- [ ] RLS bloquea SELECT cross-tenant (probar con 2 usuarios)
- [ ] Inputs con `<script>` sanitizados
- [ ] No hay secrets en cliente
- [ ] Server actions validan permisos antes de mutar

## Responsive y UX

- [ ] Sidebar colapsable en mobile
- [ ] Formularios usables en pantalla chica
- [ ] Mensajes de error claros en español
- [ ] Estados vacíos con icono y acción

## Tests automatizados

```bash
npm test
```

- [ ] `permissions.test.ts` pasa
- [ ] `validations.test.ts` pasa
- [ ] `services.test.ts` pasa
