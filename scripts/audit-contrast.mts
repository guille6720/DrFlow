import { contrastRatio, THEME_CONTRAST_PAIRS, requiredRatio } from "../src/core/theme/contrast";

let failed = 0;
for (const p of THEME_CONTRAST_PAIRS) {
  const role = p.role ?? (p.large ? "largeText" : "text");
  const need = requiredRatio(role);
  const r = contrastRatio(p.fg, p.bg);
  const ok = r >= need;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK" : "FAIL"}\t${r.toFixed(2)}\tneed ${need}\t${role}\t${p.id}`);
}
console.log(failed === 0 ? "\nAll pairs pass WCAG AA floors." : `\n${failed} pair(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
