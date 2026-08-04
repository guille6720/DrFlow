import type { LegalDocument } from "@/core/legal/content/types";

export const termsOfServiceDocument: LegalDocument = {
  id: "terminos",
  title: "Términos del Servicio de DrFlow",
  sections: [
    {
      title: "1. Aceptación",
      blocks: [
        {
          type: "p",
          text: "Los presentes Términos del Servicio regulan el acceso y uso de la plataforma DrFlow. Al crear una cuenta o utilizar la plataforma, el usuario declara haber leído, comprendido y aceptado estos términos, así como la Política de Privacidad y la Política de Seguridad vigentes.",
        },
        {
          type: "p",
          text: "Si el usuario actúa en representación de un consultorio, clínica o institución, declara contar con facultades suficientes para aceptar estos términos en nombre de dicha entidad.",
        },
      ],
    },
    {
      title: "2. Definiciones",
      blocks: [
        { type: "p", text: "A los efectos del presente documento:" },
        {
          type: "ul",
          items: [
            "DrFlow: plataforma informática destinada a la gestión de consultorios y establecimientos de salud.",
            "Proveedor: titular y desarrollador de DrFlow.",
            "Usuario: profesional, consultorio, clínica o persona autorizada que utiliza la plataforma.",
            "Paciente: persona cuyos datos son registrados por el usuario.",
            "Datos Clínicos: toda información médica, administrativa o personal ingresada en DrFlow.",
          ],
        },
      ],
    },
    {
      title: "3. Objeto",
      blocks: [
        {
          type: "p",
          text: "DrFlow proporciona herramientas destinadas a la administración de consultorios y establecimientos de salud, incluyendo, entre otras:",
        },
        {
          type: "ul",
          items: [
            "Agenda médica.",
            "Gestión de turnos.",
            "Historia clínica electrónica.",
            "Fichas de pacientes.",
            "Evoluciones médicas.",
            "Gestión documental.",
            "Recetas.",
            "Certificados.",
            "Administración de profesionales.",
            "Gestión administrativa.",
            "Reportes.",
            "Portal para pacientes.",
            "Recordatorios y notificaciones.",
            "Otras funcionalidades que puedan incorporarse en futuras versiones.",
          ],
        },
        {
          type: "p",
          text: "DrFlow constituye una herramienta de apoyo a la gestión sanitaria y no reemplaza el criterio profesional del médico ni la relación médico-paciente.",
        },
      ],
    },
    {
      title: "4. Registro de usuarios",
      blocks: [
        { type: "p", text: "Para utilizar determinadas funcionalidades será necesario crear una cuenta." },
        { type: "p", text: "El usuario se compromete a:" },
        {
          type: "ul",
          items: [
            "proporcionar información verdadera y actualizada;",
            "mantener la confidencialidad de sus credenciales;",
            "no compartir su contraseña;",
            "actualizar sus datos cuando sea necesario;",
            "utilizar la plataforma únicamente con fines lícitos.",
          ],
        },
        { type: "p", text: "El usuario es responsable por toda actividad realizada desde su cuenta." },
      ],
    },
    {
      title: "5. Responsabilidades del usuario",
      blocks: [
        { type: "p", text: "El usuario será exclusivamente responsable de:" },
        {
          type: "ul",
          items: [
            "la veracidad de la información cargada;",
            "el cumplimiento de la legislación aplicable;",
            "obtener los consentimientos informados cuando correspondan;",
            "respetar el secreto profesional;",
            "mantener actualizada la historia clínica;",
            "conservar la confidencialidad de los datos de los pacientes;",
            "administrar correctamente los permisos de acceso de su personal.",
          ],
        },
      ],
    },
    {
      title: "6. Protección de datos personales",
      blocks: [
        {
          type: "p",
          text: "El usuario declara actuar como responsable del tratamiento de los datos personales de sus pacientes conforme a la Ley Nº 25.326, la Ley Nº 26.529 y demás normativa aplicable.",
        },
        {
          type: "p",
          text: "DrFlow actúa exclusivamente como proveedor tecnológico y encargado del tratamiento de los datos siguiendo las instrucciones del usuario.",
        },
        {
          type: "p",
          text: "DrFlow no comercializa ni utiliza la información clínica con fines publicitarios.",
        },
      ],
    },
    {
      title: "7. Historia clínica",
      blocks: [
        {
          type: "p",
          text: "Toda historia clínica registrada mediante DrFlow pertenece al profesional o institución titular de la cuenta.",
        },
        { type: "p", text: "El usuario es responsable de:" },
        {
          type: "ul",
          items: ["su contenido;", "su exactitud;", "su actualización;", "su conservación conforme a la normativa vigente."],
        },
      ],
    },
    {
      title: "8. Recetas y certificados",
      blocks: [
        {
          type: "p",
          text: "Las recetas, certificados y demás documentos emitidos mediante DrFlow constituyen herramientas de apoyo para el profesional.",
        },
        {
          type: "p",
          text: "Cuando corresponda, el usuario será responsable de verificar el cumplimiento de la normativa vigente, incluyendo los requisitos establecidos para recetas electrónicas u otras disposiciones legales aplicables.",
        },
      ],
    },
    {
      title: "9. Disponibilidad del servicio",
      blocks: [
        {
          type: "p",
          text: "DrFlow realiza esfuerzos razonables para mantener la disponibilidad continua del servicio.",
        },
        { type: "p", text: "No obstante, podrán producirse interrupciones por:" },
        {
          type: "ul",
          items: [
            "mantenimiento programado;",
            "actualizaciones;",
            "fallas técnicas;",
            "problemas de conectividad;",
            "fuerza mayor;",
            "hechos ajenos al control del proveedor.",
          ],
        },
      ],
    },
    {
      title: "10. Período de prueba",
      blocks: [
        {
          type: "p",
          text: "Cuando DrFlow ofrezca un período de prueba gratuito, éste tendrá la duración informada al momento del registro.",
        },
        {
          type: "p",
          text: "Finalizado dicho período, determinadas funcionalidades podrán limitarse hasta la contratación de un plan comercial.",
        },
      ],
    },
    {
      title: "11. Planes y pagos",
      blocks: [
        {
          type: "p",
          text: "Los servicios pagos se regirán por los valores publicados por DrFlow al momento de la contratación.",
        },
        { type: "p", text: "Salvo disposición expresa en contrario:" },
        {
          type: "ul",
          items: [
            "los importes podrán actualizarse con previo aviso;",
            "los pagos abonados no son reembolsables respecto de períodos ya utilizados;",
            "la falta de pago podrá ocasionar la suspensión del servicio.",
          ],
        },
      ],
    },
    {
      title: "12. Propiedad intelectual",
      blocks: [
        {
          type: "p",
          text: "Todo el software, diseño, interfaz, logotipos, código fuente, documentación, bases de datos, nombres comerciales y demás elementos de DrFlow son propiedad del proveedor o de sus respectivos titulares.",
        },
        {
          type: "p",
          text: "El uso de la plataforma no implica cesión alguna de derechos de propiedad intelectual.",
        },
        {
          type: "p",
          text: "Queda prohibida la reproducción, copia, modificación, ingeniería inversa, distribución o explotación no autorizada de cualquier componente de DrFlow.",
        },
      ],
    },
    {
      title: "13. Uso prohibido",
      blocks: [
        { type: "p", text: "El usuario se compromete a no:" },
        {
          type: "ul",
          items: [
            "utilizar la plataforma para actividades ilícitas;",
            "intentar acceder a información de otras cuentas;",
            "alterar el funcionamiento del sistema;",
            "introducir software malicioso;",
            "realizar pruebas de intrusión sin autorización;",
            "copiar o distribuir el software sin autorización;",
            "utilizar DrFlow para fines distintos de aquellos para los cuales fue desarrollado.",
          ],
        },
      ],
    },
    {
      title: "14. Exportación de datos",
      blocks: [
        {
          type: "p",
          text: "El usuario podrá solicitar la exportación de su información conforme a las funcionalidades disponibles y a las condiciones comerciales vigentes.",
        },
        { type: "p", text: "La información clínica pertenece al usuario titular de la cuenta." },
      ],
    },
    {
      title: "15. Suspensión y cancelación",
      blocks: [
        { type: "p", text: "DrFlow podrá suspender temporal o definitivamente una cuenta cuando:" },
        {
          type: "ul",
          items: [
            "exista incumplimiento de estos términos;",
            "se detecten actividades fraudulentas;",
            "se comprometa la seguridad de la plataforma;",
            "exista obligación legal o requerimiento de autoridad competente.",
          ],
        },
      ],
    },
    {
      title: "16. Limitación de responsabilidad",
      blocks: [
        {
          type: "p",
          text: "DrFlow constituye una herramienta informática de apoyo a la gestión sanitaria.",
        },
        {
          type: "p",
          text: "El proveedor no garantiza resultados médicos, diagnósticos, tratamientos ni decisiones clínicas.",
        },
        {
          type: "p",
          text: "La responsabilidad profesional frente al paciente corresponde exclusivamente al profesional o institución que utiliza la plataforma.",
        },
        {
          type: "p",
          text: "El proveedor tampoco será responsable por pérdidas derivadas de interrupciones de servicios de terceros, fallas de conectividad, fuerza mayor o uso indebido de la plataforma por parte del usuario.",
        },
      ],
    },
    {
      title: "17. Modificaciones",
      blocks: [
        {
          type: "p",
          text: "DrFlow podrá modificar estos Términos del Servicio cuando resulte necesario por cambios normativos, mejoras técnicas o incorporación de nuevas funcionalidades.",
        },
        { type: "p", text: "La versión vigente será la publicada dentro de la plataforma." },
        { type: "p", text: "El uso continuado del servicio implicará la aceptación de las modificaciones." },
      ],
    },
    {
      title: "18. Terminación",
      blocks: [
        { type: "p", text: "El usuario podrá solicitar la baja de su cuenta en cualquier momento." },
        {
          type: "p",
          text: "Una vez finalizada la relación contractual, DrFlow podrá conservar determinada información durante los plazos exigidos por la legislación aplicable y posteriormente proceder a su eliminación segura, salvo solicitud de exportación o existencia de obligaciones legales de conservación.",
        },
      ],
    },
    {
      title: "19. Ley aplicable y jurisdicción",
      blocks: [
        {
          type: "p",
          text: "Los presentes Términos del Servicio se rigen por las leyes de la República Argentina.",
        },
        {
          type: "p",
          text: "Toda controversia derivada de su interpretación o ejecución será sometida a la jurisdicción de los tribunales ordinarios competentes de la República Argentina, salvo que la normativa aplicable establezca una competencia diferente.",
        },
      ],
    },
    {
      title: "20. Contacto",
      blocks: [
        {
          type: "p",
          text: "Para consultas legales, administrativas o relacionadas con estos Términos del Servicio, el usuario podrá comunicarse con el soporte oficial de DrFlow mediante los canales de contacto publicados en la plataforma.",
        },
      ],
    },
  ],
};
