# WhatsApp Business — Fase 2C

Integración con **Meta WhatsApp Cloud API** para envío automático de mensajes. Sin credenciales, DrFlow mantiene el modo **manual** (`wa.me` con mensaje prellenado).

## Modos

| Modo | Condición | Comportamiento |
|------|-----------|----------------|
| **API** | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` | POST a Graph API — mensaje enviado al paciente |
| **Manual** | Sin credenciales | Abre `wa.me` — el staff debe tocar Enviar |

## Variables de entorno (Vercel)

```env
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_API_VERSION=v21.0   # opcional
```

Obtener credenciales: [Meta for Developers](https://developers.facebook.com/) → App → WhatsApp → API Setup.

## Flujos integrados

1. **Recordatorios manuales** (`/recordatorios`) — botón WhatsApp por turno
2. **Cola automática** — `appointment_notification_queue` (confirmación, 48h, 24h) vía cron `/api/jobs/process`
3. **Videoconsulta** — envío de link cuando el paciente no tiene email pero sí teléfono
4. **Jobs `send_reminder`** — canal whatsapp en worker de clínica

## Teléfonos Argentina

Se normalizan con la misma lógica que `wa.me` (`549…` para móviles de 10 dígitos).

## Limitaciones

- Requiere número verificado en Meta Business / WABA
- Plantillas obligatorias para mensajes proactivos fuera de ventana 24h (recordatorios pueden requerir template aprobado en producción)
- Un token WABA por despliegue DrFlow (como Resend/SMTP en 2B)
- Compartir receta por WhatsApp sigue en modo manual desde el wizard (wa.me)

## Archivos clave

- `src/core/whatsapp/provider.ts` — Cloud API
- `src/lib/services/whatsapp-message.ts` — adapter API/manual
- `src/lib/services/reminder-whatsapp.ts` — recordatorios
- `src/core/notifications/process-appointment-notifications.ts` — cola automática
