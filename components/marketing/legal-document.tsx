import * as React from "react";
import { Scale } from "lucide-react";
import { Container, Eyebrow } from "./primitives";

export interface LegalSection {
  id: string;
  title: string;
  body: React.ReactNode;
}

/** Long-form legal page: placeholder notice, table of contents and numbered sections. */
export function LegalDocument({
  eyebrow,
  title,
  intro,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <Container className="pb-24 pt-14 sm:pt-20">
      <header className="mx-auto max-w-3xl text-center">
        <div className="flex justify-center">
          <Eyebrow icon={Scale}>{eyebrow}</Eyebrow>
        </div>
        <h1 className="mt-5 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm text-ink-faint">Draft version · not yet in effect</p>
      </header>

      <div
        role="note"
        className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-5 py-4 text-sm text-amber-100/90 sm:flex-row sm:items-start"
      >
        <span className="mt-0.5 w-fit flex-none whitespace-nowrap rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-200">
          Placeholder for legal review
        </span>
        <p className="leading-relaxed">
          This text outlines the structure and intent of the document. It has not been reviewed by a lawyer and is not a binding
          agreement. Items in [square brackets] still need real details.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Sections" className="hidden lg:block">
          <div className="sticky top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Contents</p>
            <ol className="mt-4 space-y-1 border-l border-line">
              {sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="-ml-px flex gap-2 border-l border-transparent py-1.5 pl-4 text-sm text-ink-muted transition hover:border-cyan-400 hover:text-cyan-200"
                  >
                    <span className="tabular-nums text-ink-faint">{index + 1}.</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <article className="card min-w-0 p-6 sm:p-10">
          <div className="prose-atrium [&_a]:text-cyan-300 [&_a:hover]:text-cyan-200">
            <div className="[&>p:first-child]:mt-0">{intro}</div>
            {sections.map((section, index) => (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-28">
                <h2 id={`${section.id}-title`}>
                  {index + 1}. {section.title}
                </h2>
                {section.body}
              </section>
            ))}
          </div>
        </article>
      </div>
    </Container>
  );
}
