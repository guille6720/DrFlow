import fs from "node:fs";

const t = fs.readFileSync("public/superadmin-manual/recommendations.svg", "utf8");
console.log("has Clínica ascii?", /Cl.nica/.test(t));
const m = t.match(/Cl[\s\S]{0,3}nica/);
console.log("match", m && JSON.stringify(m[0]));
const weird = [...t].filter((c) => {
  const n = c.charCodeAt(0);
  return (n < 32 && c !== "\n" && c !== "\r") || n > 127;
});
console.log(
  "weird chars",
  [...new Set(weird)].map((c) => `${JSON.stringify(c)} U+${c.charCodeAt(0).toString(16)}`)
);

const markup = fs.readFileSync(
  "src/core/components/superadmin/manual/manual-illustration-markup.ts",
  "utf8"
);
const ctrl = [...markup].filter((c) => {
  const n = c.charCodeAt(0);
  return n < 32 && c !== "\n" && c !== "\r" && c !== "\t";
});
console.log("ctrl in markup", ctrl.length, ctrl.slice(0, 5).map((c) => c.charCodeAt(0)));
