import type { LegalDocument } from "@/core/legal/content/types";

export const softwareLicensesDocument: LegalDocument = {
  id: "licencias",
  title: "Licencias de Software y Propiedad Intelectual de NexClinic",
  sections: [
    {
      title: "1. Objeto",
      blocks: [
        {
          type: "p",
          text: "El presente documento regula los derechos de propiedad intelectual y las condiciones de uso del software NexClinic, así como de todos sus componentes, funcionalidades y contenidos.",
        },
        {
          type: "p",
          text: "Complementa los Términos del Servicio y los demás documentos legales de la plataforma.",
        },
      ],
    },
    {
      title: "2. Titularidad",
      blocks: [
        {
          type: "p",
          text: "NexClinic, incluyendo su software, código fuente, arquitectura, diseño, interfaz gráfica, logotipos, documentación, bases de datos propias, nombre comercial, marca, contenido original y demás componentes, constituye propiedad intelectual de su titular o de los respectivos licenciantes.",
        },
        { type: "p", text: "Todos los derechos no concedidos expresamente quedan reservados." },
      ],
    },
    {
      title: "3. Licencia de uso",
      blocks: [
        { type: "p", text: "NexClinic concede al usuario una licencia de uso:" },
        {
          type: "ul",
          items: [
            "limitada;",
            "personal;",
            "revocable;",
            "no exclusiva;",
            "intransferible;",
            "no sublicenciable.",
          ],
        },
        {
          type: "p",
          text: "La licencia únicamente autoriza la utilización de la plataforma conforme a los planes contratados y durante la vigencia de la relación contractual.",
        },
        { type: "p", text: "La licencia no implica transferencia de propiedad sobre el software." },
      ],
    },
    {
      title: "4. Usos permitidos",
      blocks: [
        { type: "p", text: "El usuario podrá utilizar NexClinic exclusivamente para:" },
        {
          type: "ul",
          items: [
            "administrar consultorios;",
            "gestionar pacientes;",
            "registrar historias clínicas;",
            "emitir documentación médica;",
            "administrar turnos;",
            "utilizar las funcionalidades disponibles conforme al plan contratado.",
          ],
        },
      ],
    },
    {
      title: "5. Usos prohibidos",
      blocks: [
        { type: "p", text: "Sin autorización expresa del titular, queda prohibido:" },
        {
          type: "ul",
          items: [
            "copiar el software;",
            "reproducir total o parcialmente la plataforma;",
            "modificar el código;",
            "distribuir copias;",
            "vender o alquilar el software;",
            "sublicenciar;",
            "descompilar;",
            "realizar ingeniería inversa;",
            "intentar obtener el código fuente;",
            "eliminar avisos de propiedad intelectual;",
            "desarrollar productos derivados utilizando componentes de NexClinic;",
            "utilizar la plataforma para prestar servicios que compitan directamente con NexClinic.",
          ],
        },
      ],
    },
    {
      title: "6. Software de terceros",
      blocks: [
        {
          type: "p",
          text: "NexClinic podrá incorporar componentes desarrollados por terceros, incluyendo software de código abierto u otras bibliotecas licenciadas.",
        },
        {
          type: "p",
          text: "Cada componente conservará su licencia original y sus respectivos derechos de autor.",
        },
        {
          type: "p",
          text: "Cuando la licencia correspondiente así lo exija, NexClinic pondrá a disposición del usuario la información relativa a dichas licencias.",
        },
      ],
    },
    {
      title: "7. Marcas",
      blocks: [
        {
          type: "p",
          text: "\"NexClinic\", su logotipo, nombre comercial, identidad visual y demás signos distintivos constituyen marcas o elementos identificatorios del titular.",
        },
        { type: "p", text: "No podrán utilizarse sin autorización previa y por escrito." },
      ],
    },
    {
      title: "8. Derechos sobre los datos",
      blocks: [
        {
          type: "p",
          text: "Los datos cargados por los usuarios continúan siendo propiedad del profesional, consultorio o institución titular de la cuenta.",
        },
        { type: "p", text: "NexClinic no adquiere derechos de propiedad sobre:" },
        {
          type: "ul",
          items: [
            "historias clínicas;",
            "recetas;",
            "certificados;",
            "archivos;",
            "imágenes;",
            "documentación médica;",
            "datos personales;",
            "información administrativa.",
          ],
        },
        {
          type: "p",
          text: "El usuario concede únicamente la autorización necesaria para que NexClinic procese dicha información con el fin de prestar el servicio contratado.",
        },
      ],
    },
    {
      title: "9. Mejoras de la plataforma",
      blocks: [
        {
          type: "p",
          text: "NexClinic podrá desarrollar nuevas funcionalidades, mejoras, actualizaciones y modificaciones del software.",
        },
        {
          type: "p",
          text: "Todos los derechos sobre dichas mejoras pertenecerán exclusivamente al titular de NexClinic.",
        },
        {
          type: "p",
          text: "Las sugerencias o comentarios enviados por los usuarios podrán ser utilizados libremente por NexClinic para mejorar la plataforma, sin generar obligación de compensación económica.",
        },
      ],
    },
    {
      title: "10. Actualizaciones",
      blocks: [
        { type: "p", text: "Las actualizaciones podrán incluir:" },
        {
          type: "ul",
          items: [
            "nuevas funcionalidades;",
            "mejoras de seguridad;",
            "corrección de errores;",
            "optimizaciones de rendimiento;",
            "cambios en la interfaz;",
            "adaptaciones legales.",
          ],
        },
        {
          type: "p",
          text: "Las actualizaciones podrán instalarse automáticamente cuando resulte necesario para garantizar el correcto funcionamiento del servicio.",
        },
      ],
    },
    {
      title: "11. Suspensión de la licencia",
      blocks: [
        { type: "p", text: "La licencia podrá suspenderse o finalizar cuando:" },
        {
          type: "ul",
          items: [
            "finalice la relación contractual;",
            "exista incumplimiento de los Términos del Servicio;",
            "se detecte un uso indebido del software;",
            "se produzcan actividades fraudulentas;",
            "exista obligación legal.",
          ],
        },
        {
          type: "p",
          text: "La finalización de la licencia no modifica la titularidad de los datos del usuario ni las obligaciones legales de conservación que resulten aplicables.",
        },
      ],
    },
    {
      title: "12. Protección de la propiedad intelectual",
      blocks: [
        {
          type: "p",
          text: "NexClinic podrá adoptar las medidas legales, administrativas y técnicas que considere necesarias para proteger sus derechos de propiedad intelectual frente a usos no autorizados.",
        },
      ],
    },
    {
      title: "13. Infracciones",
      blocks: [
        { type: "p", text: "El uso no autorizado del software o de cualquiera de sus componentes podrá dar lugar a:" },
        {
          type: "ul",
          items: [
            "suspensión inmediata del servicio;",
            "cancelación de la cuenta;",
            "reclamos por daños y perjuicios;",
            "acciones civiles o penales cuando correspondan conforme a la legislación aplicable.",
          ],
        },
      ],
    },
    {
      title: "14. Legislación aplicable",
      blocks: [
        {
          type: "p",
          text: "El presente documento se rige por las leyes de la República Argentina, incluyendo las normas aplicables en materia de propiedad intelectual, derechos de autor y protección del software.",
        },
      ],
    },
    {
      title: "15. Contacto",
      blocks: [
        {
          type: "p",
          text: "Las consultas relacionadas con licencias, propiedad intelectual o autorizaciones de uso podrán realizarse mediante los canales oficiales de contacto publicados por NexClinic.",
        },
      ],
    },
  ],
};
