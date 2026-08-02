import type { LegalDocument } from "@/lib/legal/content/types";

export const backupsPolicyDocument: LegalDocument = {
  id: "backups",
  title: "Política de Backups y Recuperación de Datos",
  sections: [
    {
      title: "1. Objetivo",
      blocks: [
        {
          type: "p",
          text: "La presente Política establece los lineamientos generales para la realización de copias de seguridad, recuperación de información y continuidad operativa de la plataforma DrFlow.",
        },
        {
          type: "p",
          text: "Su finalidad es reducir el riesgo de pérdida de datos y facilitar la recuperación del servicio ante incidentes técnicos, errores humanos o eventos imprevistos.",
        },
      ],
    },
    {
      title: "2. Alcance",
      blocks: [
        { type: "p", text: "Esta Política aplica a toda la información almacenada en DrFlow, incluyendo, entre otros:" },
        {
          type: "ul",
          items: [
            "Historias clínicas.",
            "Fichas de pacientes.",
            "Agenda y turnos.",
            "Recetas.",
            "Certificados.",
            "Archivos adjuntos.",
            "Documentación clínica.",
            "Datos administrativos.",
            "Configuración de usuarios.",
            "Registros de auditoría.",
          ],
        },
      ],
    },
    {
      title: "3. Copias de seguridad",
      blocks: [
        {
          type: "p",
          text: "DrFlow realiza copias de seguridad periódicas de la información crítica para garantizar la continuidad del servicio.",
        },
        { type: "p", text: "Las copias pueden incluir:" },
        {
          type: "ul",
          items: [
            "bases de datos;",
            "archivos almacenados por los usuarios;",
            "configuraciones esenciales del sistema;",
            "registros necesarios para la recuperación del servicio.",
          ],
        },
      ],
    },
    {
      title: "4. Protección de los respaldos",
      blocks: [
        {
          type: "p",
          text: "Las copias de seguridad son protegidas mediante medidas técnicas y organizativas razonables para evitar accesos no autorizados, alteraciones, pérdidas, destrucción accidental o divulgación indebida.",
        },
        {
          type: "p",
          text: "Cuando resulte técnicamente posible, los respaldos podrán almacenarse utilizando mecanismos de cifrado y controles de acceso.",
        },
      ],
    },
    {
      title: "5. Frecuencia",
      blocks: [
        { type: "p", text: "La frecuencia de los respaldos podrá variar según:" },
        {
          type: "ul",
          items: [
            "las necesidades operativas;",
            "el volumen de información;",
            "la infraestructura utilizada;",
            "el plan contratado;",
            "criterios técnicos del proveedor.",
          ],
        },
        {
          type: "p",
          text: "DrFlow podrá modificar la estrategia de respaldos cuando resulte necesario para mejorar la seguridad o la continuidad del servicio.",
        },
      ],
    },
    {
      title: "6. Recuperación de información",
      blocks: [
        {
          type: "p",
          text: "Ante un incidente técnico, DrFlow realizará esfuerzos razonables para restaurar la información disponible utilizando las copias de seguridad existentes.",
        },
        { type: "p", text: "La recuperación dependerá, entre otros factores, de:" },
        {
          type: "ul",
          items: [
            "la naturaleza del incidente;",
            "el estado de la infraestructura;",
            "la disponibilidad de los respaldos;",
            "las limitaciones técnicas existentes.",
          ],
        },
      ],
    },
    {
      title: "7. Objetivos de recuperación",
      blocks: [
        {
          type: "p",
          text: "DrFlow procurará restablecer el servicio dentro de un plazo razonable una vez resuelto el incidente que motivó la interrupción.",
        },
        {
          type: "p",
          text: "No se garantiza la recuperación absoluta de toda la información en todos los supuestos, especialmente cuando la pérdida derive de circunstancias ajenas al control razonable del proveedor.",
        },
      ],
    },
    {
      title: "8. Exportación de datos",
      blocks: [
        {
          type: "p",
          text: "El titular de la cuenta podrá solicitar la exportación de la información disponible conforme a las funcionalidades de la plataforma y a las condiciones comerciales vigentes.",
        },
        {
          type: "p",
          text: "La exportación podrá realizarse en formatos técnicamente disponibles al momento de la solicitud.",
        },
      ],
    },
    {
      title: "9. Responsabilidades del usuario",
      blocks: [
        { type: "p", text: "El usuario es responsable de:" },
        {
          type: "ul",
          items: [
            "verificar la información registrada;",
            "conservar la documentación que considere crítica;",
            "descargar los datos cuando resulte necesario;",
            "solicitar la exportación antes de la cancelación definitiva del servicio.",
          ],
        },
      ],
    },
    {
      title: "10. Limitaciones",
      blocks: [
        {
          type: "p",
          text: "Aunque DrFlow implementa mecanismos de respaldo, ninguna solución informática puede garantizar la inexistencia absoluta de pérdida de información.",
        },
        { type: "p", text: "DrFlow no será responsable por pérdidas derivadas de:" },
        {
          type: "ul",
          items: [
            "fuerza mayor;",
            "desastres naturales;",
            "fallas generalizadas de proveedores externos;",
            "actos maliciosos de terceros;",
            "uso indebido de la plataforma;",
            "eliminación de información realizada por usuarios autorizados;",
            "circunstancias fuera de su control razonable.",
          ],
        },
      ],
    },
    {
      title: "11. Continuidad operativa",
      blocks: [
        {
          type: "p",
          text: "DrFlow implementará medidas razonables destinadas a restablecer la prestación del servicio luego de incidentes técnicos, procurando minimizar el tiempo de indisponibilidad y preservar la integridad de la información.",
        },
      ],
    },
    {
      title: "12. Conservación de respaldos",
      blocks: [
        {
          type: "p",
          text: "Las copias de seguridad podrán conservarse durante el tiempo que DrFlow considere necesario para garantizar la continuidad operativa, cumplir obligaciones legales o atender requerimientos técnicos.",
        },
        {
          type: "p",
          text: "Una vez cumplido dicho plazo, podrán ser eliminadas de manera segura.",
        },
      ],
    },
    {
      title: "13. Actualizaciones",
      blocks: [
        {
          type: "p",
          text: "Esta Política podrá modificarse para adaptarse a cambios tecnológicos, mejoras de infraestructura o modificaciones normativas.",
        },
        { type: "p", text: "La versión vigente será la publicada en DrFlow." },
      ],
    },
    {
      title: "14. Contacto",
      blocks: [
        {
          type: "p",
          text: "Las consultas relacionadas con la recuperación de datos, exportación de información o continuidad del servicio podrán realizarse mediante los canales oficiales de soporte publicados en la plataforma.",
        },
      ],
    },
  ],
};
