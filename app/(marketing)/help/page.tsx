import type { Metadata } from "next";
import { HelpCenter } from "@/components/marketing/help-center";
import { Container, CtaBand, Eyebrow, PageIntro } from "@/components/marketing/primitives";

export const metadata: Metadata = {
  title: "Help centre",
  description: "Answers about setting up Atrium, sharing work with clients, approvals, roles, plans and account security.",
};

export default function HelpPage() {
  return (
    <>
      <PageIntro
        eyebrow={<Eyebrow>Help centre</Eyebrow>}
        title="How can we help?"
        description="Short answers about setting up your workspace, sharing work with clients, approvals, roles and billing."
        className="pb-10 sm:pb-12"
      />
      <Container className="pb-8">
        <HelpCenter />
      </Container>
      <CtaBand
        title="Learn faster by clicking around."
        description="The demo workspace is full of sample projects and clients. Sign in as any role and try the things these articles describe."
      />
    </>
  );
}
