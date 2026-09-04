import type { LegalDocument } from "@/core/legal/content/types";

export const securityPolicyDocument: LegalDocument = {
  id: "seguridad",
  title: "Política de Seguridad de la Información de NexClinic",
  sections: [
    {
      title: "1. Objetivo",
      blocks: [
        {
          type: "p",
          text: "La presente Política de Seguridad de la Información establece las medidas técnicas y organizativas implementadas por NexClinic para proteger la confidencialidad, integridad, disponibilidad y trazabilidad de la información procesada mediante la plataforma.",
        },
        {
          type: "p",
          text: "Su objetivo es minimizar los riesgos de acceso no autorizado, pérdida, alteración o divulgación de datos personales y datos de salud.",
        },
      ],
    },
    {
      title: "2. Alcance",
      blocks: [
        { type: "p", text: "Esta política aplica a:" },
        {
          type: "ul",
          items: [
            "Profesionales de la salud.",
            "Consultorios.",
            "Clínicas e instituciones.",
            "Secretarios y administrativos.",
            "Usuarios autorizados por el titular de la cuenta.",
            "Personal técnico autorizado de NexClinic cuando sea necesario para tareas de soporte o mantenimiento.",
          ],
        },
      ],
    },
    {
      title: "3. Principios de seguridad",
      blocks: [
        { type: "p", text: "NexClinic basa su funcionamiento en los siguientes principios:" },
        {
          type: "ul",
          items: [
            "Confidencialidad de la información.",
            "Integridad de los datos.",
            "Disponibilidad del servicio.",
            "Trazabilidad de las acciones realizadas.",
            "Acceso basado en permisos.",
            "Mínimo privilegio necesario.",
            "Mejora continua de la seguridad.",
          ],
        },
      ],
    },
    {
      title: "4. Protección de la información",
      blocks: [
        { type: "p", text: "NexClinic implementa medidas razonables de seguridad, entre ellas:" },
        {
          type: "ul",
          items: [
            "comunicaciones cifradas mediante HTTPS/TLS;",
            "autenticación de usuarios;",
            "almacenamiento protegido;",
            "separación lógica de la información entre clínicas y consultorios;",
            "control de permisos por usuario;",
            "registros de auditoría;",
            "copias de seguridad periódicas;",
            "monitoreo técnico del servicio;",
            "actualizaciones de seguridad cuando resulte necesario.",
          ],
        },
      ],
    },
    {
      title: "5. Gestión de usuarios",
      blocks: [
        {
          type: "p",
          text: "Cada usuario posee una cuenta individual con credenciales personales e intransferibles.",
        },
        { type: "p", text: "El titular de la cuenta deberá:" },
        {
          type: "ul",
          items: [
            "asignar únicamente los permisos necesarios;",
            "eliminar usuarios que ya no formen parte del equipo;",
            "revisar periódicamente los accesos;",
            "proteger las credenciales de acceso;",
            "evitar compartir contraseñas.",
          ],
        },
        { type: "p", text: "NexClinic podrá suspender cuentas cuando detecte riesgos para la seguridad." },
      ],
    },
    {
      title: "6. Contraseñas",
      blocks: [
        {
          type: "p",
          text: "Los usuarios son responsables de mantener la confidencialidad de sus credenciales.",
        },
        { type: "p", text: "Se recomienda utilizar contraseñas robustas que incluyan:" },
        {
          type: "ul",
          items: ["letras mayúsculas;", "letras minúsculas;", "números;", "caracteres especiales."],
        },
        {
          type: "p",
          text: "Asimismo, se recomienda evitar reutilizar contraseñas utilizadas en otros servicios.",
        },
      ],
    },
    {
      title: "7. Control de acceso",
      blocks: [
        {
          type: "p",
          text: "El acceso a la información se encuentra limitado según el rol asignado por el administrador del consultorio.",
        },
        { type: "p", text: "Los permisos podrán diferenciar, entre otros, a:" },
        {
          type: "ul",
          items: [
            "administradores;",
            "médicos;",
            "secretarios;",
            "personal administrativo;",
            "otros perfiles que incorpore la plataforma.",
          ],
        },
        {
          type: "p",
          text: "Cada usuario únicamente podrá acceder a la información necesaria para el desarrollo de sus funciones.",
        },
      ],
    },
    {
      title: "8. Auditoría y trazabilidad",
      blocks: [
        {
          type: "p",
          text: "NexClinic puede registrar eventos relevantes para fines de seguridad y auditoría, incluyendo:",
        },
        {
          type: "ul",
          items: [
            "inicio y cierre de sesión;",
            "accesos a historias clínicas;",
            "modificaciones de datos;",
            "emisión de recetas;",
            "creación y cancelación de turnos;",
            "cambios de configuración;",
            "altas y bajas de usuarios;",
            "otras acciones relevantes.",
          ],
        },
        {
          type: "p",
          text: "Los registros podrán utilizarse para investigaciones internas, soporte técnico, prevención de fraudes y cumplimiento legal.",
        },
      ],
    },
    {
      title: "9. Copias de seguridad",
      blocks: [
        {
          type: "p",
          text: "NexClinic realiza copias de seguridad periódicas con el objetivo de reducir el riesgo de pérdida de información.",
        },
        {
          type: "p",
          text: "Las copias podrán almacenarse utilizando mecanismos de protección adecuados y ser utilizadas exclusivamente para recuperación ante incidentes.",
        },
        {
          type: "p",
          text: "La frecuencia y retención de los respaldos podrán modificarse conforme a las necesidades operativas del servicio.",
        },
      ],
    },
    {
      title: "10. Disponibilidad del servicio",
      blocks: [
        {
          type: "p",
          text: "NexClinic realiza esfuerzos razonables para mantener una alta disponibilidad.",
        },
        { type: "p", text: "No obstante, podrán producirse interrupciones por:" },
        {
          type: "ul",
          items: [
            "mantenimiento programado;",
            "actualizaciones;",
            "fallas de infraestructura;",
            "problemas de proveedores externos;",
            "incidentes de seguridad;",
            "causas de fuerza mayor.",
          ],
        },
        {
          type: "p",
          text: "Siempre que resulte posible, los mantenimientos programados serán informados con antelación.",
        },
      ],
    },
    {
      title: "11. Incidentes de seguridad",
      blocks: [
        { type: "p", text: "Ante un incidente de seguridad, NexClinic podrá:" },
        {
          type: "ul",
          items: [
            "contener el incidente;",
            "investigar su origen;",
            "restaurar el funcionamiento del servicio;",
            "preservar evidencias técnicas cuando corresponda;",
            "adoptar medidas correctivas para evitar su repetición.",
          ],
        },
        {
          type: "p",
          text: "Cuando el incidente pueda afectar significativamente la confidencialidad, integridad o disponibilidad de los datos, el titular de la cuenta será informado dentro de un plazo razonable.",
        },
      ],
    },
    {
      title: "12. Equipos y dispositivos",
      blocks: [
        {
          type: "p",
          text: "Los usuarios son responsables de proteger los dispositivos utilizados para acceder a NexClinic.",
        },
        { type: "p", text: "Se recomienda:" },
        {
          type: "ul",
          items: [
            "mantener el sistema operativo actualizado;",
            "utilizar antivirus cuando corresponda;",
            "bloquear el dispositivo al ausentarse;",
            "evitar acceder desde equipos públicos o no confiables;",
            "cerrar sesión al finalizar el uso.",
          ],
        },
      ],
    },
    {
      title: "13. Uso aceptable",
      blocks: [
        { type: "p", text: "Queda prohibido:" },
        {
          type: "ul",
          items: [
            "compartir usuarios;",
            "intentar acceder a cuentas ajenas;",
            "modificar información sin autorización;",
            "realizar pruebas de intrusión;",
            "introducir software malicioso;",
            "utilizar la plataforma para actividades ilícitas;",
            "interferir con el funcionamiento normal del servicio.",
          ],
        },
      ],
    },
    {
      title: "14. Conservación de registros",
      blocks: [
        { type: "p", text: "Los registros de auditoría podrán conservarse durante el tiempo necesario para:" },
        {
          type: "ul",
          items: [
            "garantizar la seguridad del sistema;",
            "atender incidentes;",
            "cumplir obligaciones legales;",
            "responder requerimientos judiciales o administrativos.",
          ],
        },
      ],
    },
    {
      title: "15. Responsabilidades",
      blocks: [
        { type: "h4", text: "Del usuario" },
        { type: "p", text: "El usuario deberá:" },
        {
          type: "ul",
          items: [
            "proteger sus credenciales;",
            "respetar los permisos asignados;",
            "informar incidentes de seguridad;",
            "utilizar la plataforma conforme a la legislación vigente.",
          ],
        },
        { type: "h4", text: "De NexClinic" },
        { type: "p", text: "NexClinic se compromete a:" },
        {
          type: "ul",
          items: [
            "implementar medidas razonables de seguridad;",
            "mantener la infraestructura técnica;",
            "corregir vulnerabilidades cuando sea posible;",
            "proteger la confidencialidad de la información;",
            "actuar como encargado del tratamiento conforme a las instrucciones del responsable.",
          ],
        },
      ],
    },
    {
      title: "16. Limitaciones",
      blocks: [
        { type: "p", text: "Ningún sistema informático puede garantizar seguridad absoluta." },
        {
          type: "p",
          text: "En consecuencia, NexClinic no garantiza la inexistencia total de incidentes derivados de ataques informáticos, vulnerabilidades de terceros, fallas de Internet, fuerza mayor o circunstancias fuera de su control razonable.",
        },
      ],
    },
    {
      title: "17. Actualizaciones",
      blocks: [
        {
          type: "p",
          text: "Esta Política de Seguridad podrá modificarse para incorporar mejoras técnicas, cambios regulatorios o nuevas funcionalidades.",
        },
        { type: "p", text: "La versión vigente será la publicada dentro de la plataforma." },
      ],
    },
    {
      title: "18. Contacto",
      blocks: [
        {
          type: "p",
          text: "Las consultas relacionadas con la seguridad de la información podrán realizarse mediante los canales oficiales de soporte y contacto publicados en NexClinic.",
        },
        {
          type: "p",
          text: "Los usuarios deberán informar de manera inmediata cualquier sospecha de acceso no autorizado, vulnerabilidad o incidente de seguridad del que tomen conocimiento.",
        },
      ],
    },
  ],
};
