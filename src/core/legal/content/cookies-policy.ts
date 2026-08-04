import type { LegalDocument } from "@/core/legal/content/types";

export const cookiesPolicyDocument: LegalDocument = {
  id: "cookies",
  title: "Política de Cookies de DrFlow",
  sections: [
    {
      title: "1. Objeto",
      blocks: [
        {
          type: "p",
          text: "La presente Política de Cookies explica cómo DrFlow utiliza cookies y tecnologías similares para mejorar el funcionamiento de la plataforma y del sitio web, optimizar la experiencia del usuario y garantizar la seguridad del servicio.",
        },
        {
          type: "p",
          text: "Al continuar utilizando DrFlow, el usuario acepta el uso de cookies conforme a esta política, salvo que las deshabilite mediante la configuración de su navegador o dispositivo cuando ello sea posible.",
        },
      ],
    },
    {
      title: "2. ¿Qué son las cookies?",
      blocks: [
        {
          type: "p",
          text: "Las cookies son pequeños archivos de texto que un sitio web o aplicación puede almacenar en el navegador o dispositivo del usuario para recordar determinada información durante una sesión o en visitas posteriores.",
        },
        { type: "p", text: "Las cookies no ejecutan programas ni contienen virus." },
      ],
    },
    {
      title: "3. Tipos de cookies utilizadas",
      blocks: [
        { type: "p", text: "DrFlow podrá utilizar las siguientes categorías de cookies:" },
        { type: "h4", text: "Cookies esenciales" },
        {
          type: "p",
          text: "Son necesarias para el funcionamiento de la plataforma. Permiten, entre otras funciones, iniciar sesión, mantener la sesión activa, autenticar usuarios, proteger la seguridad del sistema y recordar configuraciones básicas. Estas cookies no pueden deshabilitarse sin afectar el funcionamiento del servicio.",
        },
        { type: "h4", text: "Cookies de preferencias" },
        {
          type: "p",
          text: "Permiten recordar configuraciones elegidas por el usuario, tales como idioma, zona horaria, preferencias de visualización y configuraciones personalizadas.",
        },
        { type: "h4", text: "Cookies de análisis" },
        {
          type: "p",
          text: "Podrán utilizarse para obtener información estadística sobre el uso de la plataforma, incluyendo páginas visitadas, tiempo de permanencia, errores de funcionamiento y rendimiento general del sistema. La información recopilada se utiliza para mejorar DrFlow y no tiene por finalidad identificar personalmente al usuario.",
        },
        { type: "h4", text: "Cookies de seguridad" },
        {
          type: "p",
          text: "Podrán utilizarse para detectar actividades sospechosas, prevenir accesos no autorizados, proteger cuentas de usuario y prevenir fraudes y ataques informáticos.",
        },
      ],
    },
    {
      title: "4. Tecnologías similares",
      blocks: [
        { type: "p", text: "Además de cookies, DrFlow podrá utilizar otras tecnologías equivalentes, tales como:" },
        {
          type: "ul",
          items: [
            "almacenamiento local del navegador (Local Storage);",
            "almacenamiento de sesión (Session Storage);",
            "identificadores temporales de sesión;",
            "tecnologías necesarias para mantener la autenticación del usuario.",
          ],
        },
        {
          type: "p",
          text: "Estas herramientas cumplen funciones similares a las cookies y forman parte del funcionamiento normal de la plataforma.",
        },
      ],
    },
    {
      title: "5. Cookies de terceros",
      blocks: [
        {
          type: "p",
          text: "DrFlow podrá utilizar servicios proporcionados por terceros para funcionalidades específicas, tales como autenticación, análisis de rendimiento, monitoreo técnico, protección contra ataques e infraestructura tecnológica.",
        },
        {
          type: "p",
          text: "Cada proveedor tratará la información conforme a sus propias políticas de privacidad y a los acuerdos celebrados con DrFlow.",
        },
      ],
    },
    {
      title: "6. Administración de cookies",
      blocks: [
        {
          type: "p",
          text: "La mayoría de los navegadores permiten aceptar cookies, rechazarlas, eliminarlas, limitar su uso o recibir notificaciones antes de su instalación.",
        },
        {
          type: "p",
          text: "La desactivación de determinadas cookies podrá afectar el correcto funcionamiento de algunas funcionalidades de DrFlow.",
        },
      ],
    },
    {
      title: "7. Conservación",
      blocks: [
        {
          type: "p",
          text: "Las cookies podrán mantenerse durante el tiempo necesario para cumplir la finalidad para la cual fueron creadas.",
        },
        {
          type: "p",
          text: "La duración podrá variar según el tipo de cookie, la configuración del navegador y las necesidades técnicas del servicio.",
        },
      ],
    },
    {
      title: "8. Protección de datos personales",
      blocks: [
        {
          type: "p",
          text: "Cuando las cookies permitan tratar datos personales, dicho tratamiento se realizará conforme a la Política de Privacidad de DrFlow y a la legislación aplicable.",
        },
        {
          type: "p",
          text: "DrFlow no utiliza cookies para vender información personal ni para realizar publicidad basada en datos clínicos de los pacientes.",
        },
      ],
    },
    {
      title: "9. Modificaciones",
      blocks: [
        {
          type: "p",
          text: "DrFlow podrá actualizar esta Política de Cookies para incorporar nuevas funcionalidades, cambios tecnológicos o modificaciones legales.",
        },
        { type: "p", text: "La versión vigente será la publicada dentro de la plataforma o en el sitio web oficial." },
      ],
    },
    {
      title: "10. Contacto",
      blocks: [
        {
          type: "p",
          text: "Las consultas relacionadas con esta Política de Cookies podrán realizarse mediante los canales oficiales de contacto publicados por DrFlow.",
        },
      ],
    },
  ],
};
