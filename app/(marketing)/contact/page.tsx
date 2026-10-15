import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Clock3, CreditCard, Mail, MessagesSquare, ShieldAlert, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ContactForm } from "@/components/marketing/contact-form";
import { parseContactTopic } from "@/components/marketing/contact-topics";
import { Container, PageIntro } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Contact",
  description: "Questions about plans, help with your workspace or a security report. A person reads every message and replies within one business day.",
};

const CHANNELS: { icon: LucideIcon; title: string; text: React.ReactNode }[] = [
  {
    icon: MessagesSquare,
    title: "Plans and pricing",
    text: "Not sure which plan fits, or need a contract or invoice billing? Tell us about your team and client count.",
  },
  {
    icon: BookOpen,
    title: "Help with your workspace",
    text: (
      <>
        Many answers are already in the{" "}
        <Link href="/help" className="text-cyan-300 hover:text-cyan-200">
          help centre
        </Link>
        . If something looks broken, check the{" "}
        <Link href="/status" className="text-cyan-300 hover:text-cyan-200">
          status page
        </Link>{" "}
        first.
      </>
    ),
  },
  {
    icon: CreditCard,
    title: "Billing",
    text: "Questions about an invoice, a failed payment or changing plans. Include your workspace name.",
  },
  {
    icon: ShieldAlert,
    title: "Security",
    text: (
      <>
        Report a vulnerability here or at{" "}
        <a href="mailto:security@atrium.example" className="text-cyan-300 hover:text-cyan-200">
          security@atrium.example
        </a>
        . Please don&apos;t share details publicly until it&apos;s fixed.
      </>
    ),
  },
];

export default function ContactPage({ searchParams }: PageProps<"/contact">) {
  return (
    <>
      <PageIntro
        title="Talk to the Atrium team"
        description="Questions about plans, help with your workspace or a security report. A person reads every message."
        className="pb-10 sm:pb-12"
      />
      <Container className="grid gap-6 pb-24 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="min-w-0 space-y-4" aria-label="Ways we can help">
          <div className="flex items-start gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.06] p-5">
            <Clock3 size={20} className="mt-0.5 flex-none text-cyan-300" aria-hidden="true" />
            <div>
              <p className="font-semibold text-ink">We reply within one business day</p>
              <p className="mt-1 text-sm text-ink-muted">Monday to Friday. Security reports are read first.</p>
            </div>
          </div>
          <ul className="card divide-y divide-white/[0.05]">
            {CHANNELS.map((channel) => (
              <li key={channel.title} className="flex gap-4 p-5">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-cyan-500/10 text-cyan-300">
                  <channel.icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-semibold text-ink">{channel.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{channel.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 px-1 text-sm text-ink-muted">
            <Mail size={15} className="text-ink-faint" aria-hidden="true" />
            Prefer email?{" "}
            <a href="mailto:hello@atrium.example" className="text-cyan-300 hover:text-cyan-200">
              hello@atrium.example
            </a>
          </p>
        </aside>
        <Card className="min-w-0 p-5 sm:p-8">
          <h2 className="text-xl font-semibold text-ink">Send us a message</h2>
          <p className="mt-1.5 text-sm text-ink-muted">Fields marked with * are required.</p>
          <div className="mt-6">
            <Suspense fallback={<FormSkeleton />}>
              <TopicAwareForm searchParams={searchParams} />
            </Suspense>
          </div>
        </Card>
      </Container>
    </>
  );
}

async function TopicAwareForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  return <ContactForm defaultTopic={parseContactTopic(query.topic)} />;
}

function FormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[70px]" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[70px]" />
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="ml-auto h-12 w-40" />
    </div>
  );
}
