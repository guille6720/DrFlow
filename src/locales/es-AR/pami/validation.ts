/** Validation and export messages for PAMI planillas. */
export const pamiValidationMessages = {
  fieldMaxLength: (label: string, max: number) => `${label} no puede superar ${max} caracteres.`,
  payloadTooLarge: (max: number) =>
    `Los datos de la planilla son demasiado grandes (máximo ${max} caracteres en total).`,
  invalidData: "Datos de planilla inválidos.",
  emptyField: "Completá al menos un campo de la planilla antes de continuar.",
  renderedFieldLabel: "La planilla generada",
} as const;
