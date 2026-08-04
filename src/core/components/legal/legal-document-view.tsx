import type { LegalDocument } from "@/core/legal/content/types";

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <article id={document.id} className="scroll-mt-24 border-t border-slate-200 pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-bold text-slate-900">{document.title}</h2>
      <div className="mt-6 space-y-6">
        {document.sections.map((section) => (
          <section key={section.title}>
            <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
            <div className="mt-2 space-y-2">
              {section.blocks.map((block, index) => {
                if (block.type === "p") {
                  return (
                    <p key={index} className="text-sm leading-relaxed text-slate-700">
                      {block.text}
                    </p>
                  );
                }
                if (block.type === "h4") {
                  return (
                    <h4 key={index} className="pt-1 text-sm font-semibold text-slate-800">
                      {block.text}
                    </h4>
                  );
                }
                return (
                  <ul key={index} className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {block.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
