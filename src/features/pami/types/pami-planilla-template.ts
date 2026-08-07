/** Category slug — sourced from DB (`pami_planilla_categories.slug`). */
export type PamiPlanillaCategory = string;

export type PamiPlanillaCategoryMeta = {
  id: PamiPlanillaCategory;
  label: string;
  description: string;
};

export type PamiPlanillaFieldDef = {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
};

/** Shape consumed by renderPamiPlanilla() — stable contract. */
export interface PamiPlanillaTemplate {
  id: string;
  category: PamiPlanillaCategory;
  title: string;
  /** Texto base; reemplazar {{campo}} con valores del formulario */
  template: string;
  fields: PamiPlanillaFieldDef[];
}

export type PamiPlanillaCatalog = {
  categories: PamiPlanillaCategoryMeta[];
  templates: PamiPlanillaTemplate[];
};

export type PamiPlanillaRenderContext = {
  patientName: string;
  patientDni: string;
  patientPami: string;
  professionalName: string;
  licenseNumber: string;
  patientAddress?: string;
};
