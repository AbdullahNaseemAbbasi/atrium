import * as React from "react";
import { Container } from "./primitives";

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
      <header>
        <p className="text-sm text-ink-faint">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm text-ink-faint">Draft version, not yet in effect</p>
      </header>

      {/* Phones and tablets: notice, then the text. lg: contents beside the text. xl: the notice moves to a third column. */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_280px] xl:gap-12">
        <aside className="order-first lg:col-span-2 xl:order-none xl:col-span-1 xl:col-start-3 xl:row-start-1">
          <div className="xl:sticky xl:top-28">
            <p role="note" className="max-w-3xl border-l-2 border-amber-400/60 pl-4 text-sm leading-relaxed text-amber-100/90">
              Placeholder for legal review. This text sets out the structure and intent of the document. A lawyer hasn&apos;t reviewed it
              and it isn&apos;t a binding agreement. Items in [square brackets] still need real details.
            </p>
            <p className="mt-6 hidden pl-4 text-sm text-ink-muted xl:block">
              Questions about this page? Use the{" "}
              <a href="/contact" className="text-cyan-300 hover:text-cyan-200">
                contact form
              </a>
              .
            </p>
          </div>
        </aside>
        <nav aria-label="Sections" className="hidden lg:col-start-1 lg:row-start-2 lg:block xl:row-start-1">
          <div className="sticky top-28">
            <p className="text-sm font-medium text-ink-secondary">Contents</p>
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
        <article className="card min-w-0 p-6 sm:p-10 lg:col-start-2 lg:row-start-2 xl:row-start-1">
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
