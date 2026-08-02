import type { LegalDocument } from "@/lib/legal/content/types";

export const privacyPolicyDocument: LegalDocument = {
  id: "privacidad",
  title: "Política de Privacidad de DrFlow",
  sections: [
    {
      title: "1. Introducción",
      blocks: [
        {
          type: "p",
          text: "DrFlow respeta la privacidad de sus usuarios y reconoce la importancia de proteger los datos personales tratados mediante la plataforma.",
        },
        {
          type: "p",
          text: "La presente Política de Privacidad describe cómo se recopilan, utilizan, almacenan y protegen los datos personales conforme a la Ley N.º 25.326 de Protección de los Datos Personales, la Ley N.º 26.529 sobre Derechos del Paciente y demás normativa aplicable.",
        },
        { type: "p", text: "Al utilizar DrFlow, el usuario acepta esta Política de Privacidad." },
      ],
    },
    {
      title: "2. Responsable del tratamiento",
      blocks: [
        {
          type: "p",
          text: "El profesional, consultorio o institución que crea la cuenta en DrFlow es el responsable del tratamiento de los datos personales de sus pacientes.",
        },
        {
          type: "p",
          text: "DrFlow actúa como encargado del tratamiento, procesando los datos únicamente por cuenta e instrucción del responsable.",
        },
      ],
    },
    {
      title: "3. Datos que recopilamos",
      blocks: [
        {
          type: "p",
          text: "Dependiendo del uso de la plataforma, DrFlow puede procesar las siguientes categorías de información:",
        },
        { type: "h4", text: "Datos del usuario" },
        {
          type: "ul",
          items: [
            "Nombre y apellido.",
            "Matrícula profesional.",
            "Especialidad.",
            "Documento de identidad.",
            "Correo electrónico.",
            "Teléfono.",
            "Domicilio profesional.",
            "Información de facturación.",
            "Usuarios y permisos.",
          ],
        },
        { type: "h4", text: "Datos de pacientes" },
        { type: "p", text: "Según la información que el profesional decida registrar:" },
        {
          type: "ul",
          items: [
            "Datos identificatorios.",
            "Datos de contacto.",
            "Historia clínica.",
            "Antecedentes médicos.",
            "Diagnósticos.",
            "Evoluciones.",
            "Medicación.",
            "Estudios.",
            "Imágenes y archivos adjuntos.",
            "Turnos.",
            "Recetas.",
            "Certificados.",
            "Información administrativa relacionada con la atención.",
          ],
        },
      ],
    },
    {
      title: "4. Finalidad del tratamiento",
      blocks: [
        { type: "p", text: "Los datos son tratados exclusivamente para:" },
        {
          type: "ul",
          items: [
            "administrar consultorios y clínicas;",
            "gestionar turnos;",
            "confeccionar historias clínicas;",
            "emitir recetas y certificados;",
            "administrar pacientes;",
            "facilitar la comunicación entre profesionales y pacientes cuando corresponda;",
            "brindar soporte técnico;",
            "mejorar el funcionamiento de la plataforma;",
            "cumplir obligaciones legales.",
          ],
        },
        {
          type: "p",
          text: "DrFlow no utiliza datos clínicos para publicidad, venta de información ni elaboración de perfiles comerciales de pacientes.",
        },
      ],
    },
    {
      title: "5. Base legal del tratamiento",
      blocks: [
        { type: "p", text: "El tratamiento de datos personales se realiza sobre la base de:" },
        {
          type: "ul",
          items: [
            "la relación contractual entre DrFlow y el usuario;",
            "las obligaciones legales aplicables al profesional o institución;",
            "las instrucciones impartidas por el responsable del tratamiento;",
            "los consentimientos obtenidos por el profesional cuando la legislación lo requiera.",
          ],
        },
      ],
    },
    {
      title: "6. Acceso a la información",
      blocks: [
        { type: "p", text: "Sólo podrán acceder a los datos:" },
        {
          type: "ul",
          items: [
            "el profesional titular;",
            "usuarios autorizados por el titular;",
            "personal técnico de DrFlow únicamente cuando resulte estrictamente necesario para brindar soporte, mantenimiento o resolver incidentes, sujeto a deberes de confidencialidad;",
            "autoridades competentes cuando exista obligación legal.",
          ],
        },
      ],
    },
    {
      title: "7. Compartición de datos",
      blocks: [
        { type: "p", text: "DrFlow no vende ni comercializa datos personales." },
        { type: "p", text: "La información únicamente podrá compartirse cuando:" },
        {
          type: "ul",
          items: [
            "lo solicite expresamente el responsable del tratamiento;",
            "exista obligación legal;",
            "sea requerido por autoridad competente;",
            "resulte necesario para la prestación del servicio mediante proveedores tecnológicos que actúen bajo obligaciones de confidencialidad y seguridad.",
          ],
        },
      ],
    },
    {
      title: "8. Seguridad",
      blocks: [
        {
          type: "p",
          text: "DrFlow implementa medidas técnicas y organizativas razonables destinadas a proteger la información contra accesos no autorizados, alteración, pérdida, destrucción o divulgación indebida.",
        },
        { type: "p", text: "Entre ellas pueden incluirse:" },
        {
          type: "ul",
          items: [
            "conexiones cifradas;",
            "autenticación de usuarios;",
            "control de permisos;",
            "registros de auditoría;",
            "copias de seguridad;",
            "monitoreo de seguridad.",
          ],
        },
      ],
    },
    {
      title: "9. Conservación de los datos",
      blocks: [
        { type: "p", text: "Los datos se conservarán mientras:" },
        {
          type: "ul",
          items: [
            "exista una relación contractual vigente;",
            "el usuario mantenga activa su cuenta;",
            "resulte necesario para cumplir obligaciones legales;",
            "sea necesario para atender requerimientos judiciales o administrativos.",
          ],
        },
        {
          type: "p",
          text: "Una vez finalizados dichos plazos, los datos podrán ser eliminados de forma segura conforme a los procedimientos internos de DrFlow.",
        },
      ],
    },
    {
      title: "10. Derechos de los titulares de los datos",
      blocks: [
        {
          type: "p",
          text: "Los pacientes podrán ejercer los derechos reconocidos por la Ley N.º 25.326, incluyendo acceso, rectificación, actualización y supresión, cuando corresponda conforme a la normativa aplicable.",
        },
        {
          type: "p",
          text: "Las solicitudes deberán dirigirse al profesional o institución responsable del tratamiento de los datos.",
        },
      ],
    },
    {
      title: "11. Derechos del usuario de DrFlow",
      blocks: [
        { type: "p", text: "El titular de la cuenta podrá:" },
        {
          type: "ul",
          items: [
            "acceder a su información;",
            "actualizar sus datos;",
            "solicitar la exportación de la información disponible conforme a las funcionalidades del servicio;",
            "solicitar la baja de la cuenta, sujeto a las obligaciones legales de conservación que resulten aplicables.",
          ],
        },
      ],
    },
    {
      title: "12. Uso de proveedores tecnológicos",
      blocks: [
        {
          type: "p",
          text: "DrFlow podrá utilizar servicios de terceros para infraestructura, almacenamiento, correo electrónico, copias de seguridad, monitoreo, autenticación u otras funciones necesarias para operar la plataforma.",
        },
        {
          type: "p",
          text: "Estos proveedores deberán ofrecer medidas de seguridad compatibles con la naturaleza de la información tratada.",
        },
      ],
    },
    {
      title: "13. Transferencias internacionales",
      blocks: [
        {
          type: "p",
          text: "Cuando la infraestructura tecnológica implique el tratamiento o almacenamiento de información fuera de la República Argentina, DrFlow procurará que dichas transferencias se realicen conforme a la legislación aplicable y mediante proveedores que implementen medidas de seguridad adecuadas.",
        },
      ],
    },
    {
      title: "14. Cookies y tecnologías similares",
      blocks: [
        {
          type: "p",
          text: "La plataforma web podrá utilizar cookies o tecnologías similares para mantener sesiones iniciadas, recordar preferencias, mejorar la experiencia del usuario y obtener estadísticas de funcionamiento.",
        },
        {
          type: "p",
          text: "Cuando corresponda, el usuario podrá administrar dichas preferencias desde su navegador o mediante las opciones disponibles en la plataforma.",
        },
      ],
    },
    {
      title: "15. Menores de edad",
      blocks: [
        { type: "p", text: "DrFlow no está destinado a ser utilizado directamente por menores de edad." },
        {
          type: "p",
          text: "Los datos de pacientes menores únicamente serán incorporados por profesionales o instituciones autorizadas conforme a la legislación vigente.",
        },
      ],
    },
    {
      title: "16. Modificaciones",
      blocks: [
        {
          type: "p",
          text: "DrFlow podrá actualizar esta Política de Privacidad cuando resulte necesario por cambios legales, regulatorios, tecnológicos o funcionales.",
        },
        { type: "p", text: "La versión vigente será la publicada dentro de la plataforma." },
      ],
    },
    {
      title: "17. Contacto",
      blocks: [
        {
          type: "p",
          text: "Las consultas relacionadas con esta Política de Privacidad podrán realizarse mediante los canales oficiales de contacto publicados en DrFlow.",
        },
        {
          type: "p",
          text: "Cuando corresponda, los titulares de los datos personales podrán ejercer los derechos previstos por la Ley N.º 25.326 ante el responsable del tratamiento y, en su caso, ante la autoridad de control competente de la República Argentina.",
        },
      ],
    },
  ],
};
