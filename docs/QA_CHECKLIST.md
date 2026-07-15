# Checklist QA — DrFlow MVP

## Autenticación y roles

- [ ] Login con credenciales válidas redirige a `/dashboard`
- [ ] Login con credenciales inválidas muestra error humano (sin instrucciones de Dashboard)
- [ ] Google OAuth → `/auth/callback` → `/auth/complete`
- [ ] Reset password: email con `redirect_to` a dominio público (nunca localhost)
- [ ] `/auth/confirm` → formulario de nueva contraseña en &lt; 5s o error claro
- [ ] Registro en 2 pasos + Google en `/register`
- [ ] Usuario multi-clínica ve selector y cambia clínica activa
- [ ] Rutas protegidas redirigen a `/login` sin sesión
- [ ] `/qa` no aparece en sidebar para clinic_admin/doctor
- [ ] Secretaria no accede a `/configuracion`
- [ ] Superadmin ve Labs y Checklist QA

## Dashboard

- [ ] KPIs muestran 0 en estado vacío sin errores
- [ ] **Atender ahora** abre consulta en 1–2 taps
- [ ] Próximos turnos listan correctamente
- [ ] Responsive en mobile (320px+) y tablet

## Agenda

- [ ] Crear turno con datos válidos
- [ ] Error al superponer turnos del mismo profesional
- [ ] Confirmar / atender / cancelar cambia estado
- [ ] Empezar consulta abre historia con banner clínico
- [ ] Estado vacío con CTA visible

## Pacientes y coberturas

- [ ] CRUD: crear, listar, ver ficha
- [ ] Coberturas del consultorio en Configuración
- [ ] Renovación rápida de medicación (prefill)
- [ ] Labels PAMI vs N° afiliado según cobertura
- [ ] Usuario clínica A no ve pacientes clínica B

## Historia clínica y recetas

- [ ] Crear consulta con plantilla
- [ ] Banner: alergias, medicación, cobertura, adulto mayor
- [ ] Disclaimer REFEPS con checkbox explícito (no auto-aceptado)
- [ ] Copy “Receta local / borrador — no es homologación REFEPS”
- [ ] Export PDF + compartir WhatsApp

## Portal paciente

- [ ] “Receta PAMI” solo si la clínica acepta PAMI / cabecera
- [ ] Mis turnos aclara límite por dispositivo (localStorage)
- [ ] Empty states sin nombres de migraciones SQL

## Recordatorios (Labs)

- [ ] WhatsApp = “Abrir WhatsApp” (no envío automático)
- [ ] Email = simulado, honestidad en badge

## Atenciones

- [ ] Totales por presencial/virtual
- [ ] Resumen por cobertura
- [ ] Export CSV

## Seguridad transversal

- [ ] RLS bloquea SELECT cross-tenant
- [ ] No hay strings Hostinger / Supabase Dashboard / migración 00X en UI paciente/médico
- [ ] No hay secrets en cliente
- [ ] `npm test && npm run lint && npm run build` OK
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
