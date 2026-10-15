import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "Draft terms of service for Atrium. Placeholder text awaiting legal review.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "agreement",
    title: "Who these terms are between",
    body: (
      <>
        <p>
          These terms are an agreement between you and [Company legal name], a company registered in [jurisdiction] (&quot;Atrium&quot;, &quot;we&quot;).
          They apply when you create an account, use a workspace or open a client portal.
        </p>
        <p>
          If you accept these terms on behalf of a business, you confirm that you have authority to bind that business, and &quot;you&quot;
          means the business.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <ul>
        <li>You need to give accurate information when you sign up and keep it up to date.</li>
        <li>You are responsible for keeping your password safe and for activity under your account.</li>
        <li>Tell us straight away if you think someone else has accessed your account.</li>
        <li>You must be at least [16] years old to use Atrium.</li>
      </ul>
    ),
  },
  {
    id: "workspaces",
    title: "Workspaces, owners and clients",
    body: (
      <>
        <p>
          A workspace belongs to the organisation that created it. Its owners decide who joins, which role each person has and what is
          shared with each client.
        </p>
        <ul>
          <li>Owners are responsible for the people they invite and the access they grant.</li>
          <li>Client users can only use the portal they are invited to, within the limits set by the workspace.</li>
          <li>If you leave a workspace or your access is removed, the content stays with the workspace.</li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>upload content you don&apos;t have the right to share, or that is unlawful or harmful;</li>
          <li>try to access another workspace, another client&apos;s portal or data you haven&apos;t been given access to;</li>
          <li>probe, scan or test the service for vulnerabilities, except through our responsible disclosure process;</li>
          <li>disrupt the service or place an unreasonable load on it;</li>
          <li>resell or provide the service to third parties outside your workspace without our agreement.</li>
        </ul>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <>
        <p>
          You keep all rights to the files, comments and other content you or your clients put into Atrium. You give us permission to
          store, process and display that content only as needed to run the service for you.
        </p>
        <p>We don&apos;t sell your content and don&apos;t use it to train models or for advertising.</p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans, trials and payment",
    body: (
      <ul>
        <li>The Starter plan is free. Paid plans are billed monthly or yearly in advance, at the prices shown on the pricing page.</li>
        <li>A trial gives you the features and limits of the trial plan for the stated period without a payment method.</li>
        <li>Plan limits, such as active projects, client portals, seats and storage, apply as described on the pricing page.</li>
        <li>Prices exclude taxes, which are added where required. [Refund policy to be confirmed.]</li>
        <li>We will give at least [30] days&apos; notice before changing the price of a plan you are on.</li>
      </ul>
    ),
  },
  {
    id: "cancellation",
    title: "Cancellation and your data",
    body: (
      <>
        <p>
          You can cancel a paid plan at any time; it stays active until the end of the current billing period. Owners can export
          workspace data before closing a workspace.
        </p>
        <p>
          After a workspace is closed we delete its content within [30] days, except where we must keep records, such as invoices, by
          law.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes to the service",
    body: (
      <p>
        We work to keep Atrium available and publish incidents on the <Link href="/status">status page</Link>. We may change or remove
        features over time; if a change significantly reduces what a paid plan includes, we will tell you in advance. [Service level
        commitments, if any, to be confirmed.]
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <p>
        [Limitation of liability, warranty disclaimer and indemnity clauses to be drafted by counsel for the relevant jurisdiction.]
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        If we change these terms in a way that matters, we will tell workspace owners by email and in the app at least [30] days
        before the change takes effect.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms can go to <a href="mailto:legal@atrium.example">legal@atrium.example</a> or through the{" "}
        <Link href="/contact">contact form</Link>. Postal address: [registered address].
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Terms of service"
      intro={
        <p>
          These terms explain what you can expect from Atrium and what we expect from you. We&apos;ve tried to keep them short and in
          plain language. The <Link href="/privacy">privacy policy</Link> explains how we handle personal information.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
