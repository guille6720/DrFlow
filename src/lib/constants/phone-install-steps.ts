export type PhoneInstallPlatform = "android" | "ios";

export const PHONE_INSTALL_STEPS: Record<
  PhoneInstallPlatform,
  { title: string; detail: string; highlight: "menu" | "install" | "icon" | "share" }[]
> = {
  android: [
    { title: "Abrí el menú ⋮", detail: "Arriba a la derecha en Chrome", highlight: "menu" },
    { title: "Tocá Instalar app", detail: "O «Agregar a pantalla de inicio»", highlight: "install" },
    { title: "Confirmá Instalar", detail: "Queda el icono verde «Pacientes»", highlight: "icon" },
  ],
  ios: [
    { title: "Tocá Compartir", detail: "El botón abajo en Safari", highlight: "share" },
    { title: "Agregar a inicio", detail: "Desplazá y elegí esa opción", highlight: "install" },
    { title: "Tocá Agregar", detail: "Icono verde «Pacientes» en tu pantalla", highlight: "icon" },
  ],
};
