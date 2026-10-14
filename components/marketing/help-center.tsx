"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  CreditCard,
  FileCheck2,
  FolderKanban,
  LifeBuoy,
  Rocket,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { HELP_ARTICLES, HELP_CATEGORIES, type HelpArticle, type HelpCategoryKey } from "./help-articles";

const ICONS: Record<HelpCategoryKey, LucideIcon> = {
  "getting-started": Rocket,
  projects: FolderKanban,
  deliverables: FileCheck2,
  portal: Users,
  team: UserCog,
  billing: CreditCard,
  account: ShieldCheck,
};

function normalise(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

function matches(article: HelpArticle, terms: string[]) {
  if (terms.length === 0) return true;
  const haystack = normalise(`${article.title} ${article.body.join(" ")}`);
  return terms.every((term) => haystack.includes(term));
}

export function HelpCenter() {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<HelpCategoryKey | "all">("all");
  const listRef = React.useRef<HTMLDivElement>(null);

  const terms = normalise(query).split(/\s+/).filter(Boolean);
  const results = HELP_ARTICLES.filter((article) => (category === "all" || article.category === category) && matches(article, terms));
  const searching = terms.length > 0;
  const countFor = (key: HelpCategoryKey) => HELP_ARTICLES.filter((article) => article.category === key).length;

  function chooseCategory(key: HelpCategoryKey | "all") {
    setCategory(key);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const grouped = HELP_CATEGORIES.map((item) => ({ ...item, articles: results.filter((article) => article.category === item.key) })).filter(
    (item) => item.articles.length > 0,
  );

  return (
    <div>
      <div className="mx-auto -mt-4 max-w-2xl">
        <label htmlFor="help-search" className="sr-only">
          Search help articles
        </label>
        <div className="flex h-14 items-center gap-3 rounded-2xl border border-cyan-400/25 bg-[#0b1722]/90 px-4 shadow-[0_0_40px_rgba(34,211,238,.1)] transition focus-within:border-cyan-400/60 focus-within:ring-2 focus-within:ring-cyan-400/20">
          <Search size={20} className="flex-none text-cyan-300" aria-hidden="true" />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search for invitations, approvals, limits…"
            autoComplete="off"
            className="h-full w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} className="grid h-8 w-8 flex-none place-items-center rounded-lg text-ink-faint hover:bg-white/5 hover:text-ink" aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {!searching && (
        <section aria-labelledby="categories-title" className="mt-14">
          <h2 id="categories-title" className="sr-only">
            Browse by topic
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {HELP_CATEGORIES.map((item) => {
              const Icon = ICONS[item.key];
              const active = category === item.key;
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => chooseCategory(active ? "all" : item.key)}
                    aria-pressed={active}
                    className={cn(
                      "group flex h-full w-full flex-col rounded-2xl border p-5 text-left transition",
                      active
                        ? "border-cyan-400/50 bg-cyan-500/[0.08] shadow-[0_0_24px_rgba(34,211,238,.12)]"
                        : "border-line bg-surface/70 hover:border-cyan-400/25 hover:bg-surface-hover",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <span className="text-xs tabular-nums text-ink-faint">
                        {countFor(item.key)} article{countFor(item.key) === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="mt-4 font-semibold text-ink group-hover:text-cyan-100">{item.title}</span>
                    <span className="mt-1 text-sm leading-relaxed text-ink-muted">{item.description}</span>
                  </button>
                </li>
              );
            })}
            <li>
              <Link
                href="/contact?topic=support"
                className="flex h-full flex-col rounded-2xl border border-dashed border-line-strong p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.02]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.05] text-ink-muted">
                  <LifeBuoy size={19} aria-hidden="true" />
                </span>
                <span className="mt-4 font-semibold text-ink">Still stuck?</span>
                <span className="mt-1 text-sm leading-relaxed text-ink-muted">Write to support. We reply within one business day.</span>
              </Link>
            </li>
          </ul>
        </section>
      )}

      <div ref={listRef} className="mt-14 scroll-mt-28">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-ink">
            {searching ? "Search results" : category === "all" ? "All articles" : HELP_CATEGORIES.find((item) => item.key === category)?.title}
          </h2>
          <div className="flex items-center gap-3">
            <p className="text-sm text-ink-faint" aria-live="polite">
              {results.length} article{results.length === 1 ? "" : "s"}
              {searching ? ` for “${query.trim()}”` : ""}
            </p>
            {category !== "all" && (
              <button type="button" onClick={() => setCategory("all")} className={buttonClasses({ variant: "outline", size: "xs" })}>
                Show all topics
              </button>
            )}
          </div>
        </div>

        {results.length === 0 ? (
          <div className="card mt-5">
            <EmptyState
              icon={Search}
              title="No articles match that search"
              description="Try a shorter or different word, such as “invite”, “approve” or “limit”. Or ask us and we'll answer directly."
              action={
                <>
                  <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className={buttonClasses({ variant: "outline" })}>
                    Clear search
                  </button>
                  <Link href="/contact?topic=support" className={buttonClasses()}>
                    Contact support
                  </Link>
                </>
              }
            />
          </div>
        ) : (
          <div className="mt-5 space-y-8">
            {grouped.map((group) => (
              <section key={group.key} aria-labelledby={`group-${group.key}`}>
                <h3 id={`group-${group.key}`} className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300/90">
                  {group.title}
                </h3>
                <div className="divide-y divide-white/[0.06] rounded-2xl border border-line bg-surface/60">
                  {group.articles.map((article) => (
                    <details key={article.id} id={article.id} className="group scroll-mt-28 px-5 sm:px-6" open={searching && results.length <= 3}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-[15px] font-medium text-ink transition-colors hover:text-cyan-200 [&::-webkit-details-marker]:hidden">
                        {article.title}
                        <ChevronDown size={18} className="flex-none text-ink-faint transition-transform group-open:rotate-180 group-open:text-cyan-300" aria-hidden="true" />
                      </summary>
                      <div className="space-y-3 pb-5 pr-6 text-sm leading-relaxed text-ink-muted">
                        {article.body.map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
