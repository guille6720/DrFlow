import type { CommandPaletteGroup, CommandPaletteItemDef } from "@/lib/constants/command-palette-items";

export type StaticPaletteRow = {
  item: CommandPaletteItemDef;
  index: number;
};

export type StaticPaletteSection = {
  group: CommandPaletteGroup;
  rows: StaticPaletteRow[];
};

/** Precomputa índices de filas estáticas sin mutar estado durante el render. */
export function buildStaticPaletteSections(
  actionItems: CommandPaletteItemDef[],
  navItems: CommandPaletteItemDef[]
): { sections: StaticPaletteSection[]; patientStartIndex: number } {
  let index = 0;
  const sections: StaticPaletteSection[] = [];

  for (const [group, items] of [
    ["acciones", actionItems] as const,
    ["navegacion", navItems] as const,
  ]) {
    if (items.length === 0) continue;
    const start = index;
    sections.push({
      group,
      rows: items.map((item, i) => ({ item, index: start + i })),
    });
    index += items.length;
  }

  return { sections, patientStartIndex: index };
}
