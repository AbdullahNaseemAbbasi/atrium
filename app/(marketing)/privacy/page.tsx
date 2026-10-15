import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "Draft privacy policy for Atrium. Placeholder text awaiting legal review.",
};

const SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "What this policy covers",
    body: (
      <>
        <p>
          This policy explains what personal information [Company legal name] (&quot;Atrium&quot;) collects when you use the website, a workspace
          or a client portal, why we collect it and what choices you have.
        </p>
        <p>
          For content inside a workspace, the agency that owns the workspace decides what is collected and shared. For that content we act
          as a processor on the agency&apos;s behalf. [Controller and processor roles to be confirmed by counsel.]
        </p>
      </>
    ),
  },
  {
    id: "collect",
    title: "Information we collect",
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, job title, timezone and a password (stored only as a secure hash).
        </li>
        <li>
          <strong>Workspace content:</strong> projects, tasks, files, comments and approval decisions that you or your team add.
        </li>
        <li>
          <strong>Activity and security records:</strong> actions such as sign-ins, invitations, role changes, approvals and downloads,
          with the time and IP address, kept in the workspace audit log.
        </li>
        <li>
          <strong>Billing details:</strong> the plan, invoices and the card brand, last four digits and expiry date. Full card numbers
          are handled by our payment provider and never reach Atrium.
        </li>
        <li>
          <strong>Messages:</strong> what you send us through the contact form or by email.
        </li>
      </ul>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run the service: sign you in, show the right workspace and portal, and deliver notifications.</li>
        <li>To keep it secure: check access on every request, detect abuse and investigate incidents.</li>
        <li>To bill paid plans and send invoices.</li>
        <li>To answer support requests and tell you about important changes to the service.</li>
      </ul>
    ),
  },
  {
    id: "who-sees",
    title: "Who can see your information",
    body: (
      <>
        <p>
          Inside a workspace, what people see depends on their role. Client users only see projects shared with their company and
          content marked as visible to clients. Billing managers see billing information but not project data.
        </p>
        <p>
          Atrium staff do not look at workspace content unless you ask for help with a specific problem, or we need to investigate a
          security issue or a legal request. These accesses are logged.
        </p>
      </>
    ),
  },
  {
    id: "providers",
    title: "Service providers",
    body: (
      <>
        <p>We use a small number of providers to run Atrium, each bound by a data processing agreement:</p>
        <ul>
          <li>[Hosting provider] for application hosting.</li>
          <li>[Database and storage provider] for the database and private file storage.</li>
          <li>[Payment provider] for card payments and invoices.</li>
          <li>[Email provider] for sign-in, invitation and notification emails.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <p>
        Atrium sets one essential cookie to keep you signed in. It can&apos;t be read by scripts on the page and expires after seven
        days. We don&apos;t use advertising or cross-site tracking cookies. [Analytics, if added, to be described here.]
      </p>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Workspace content is kept while the workspace exists and deleted within [30] days of it being closed.</li>
        <li>Audit log entries are kept for [12 months] so owners can review past changes.</li>
        <li>Invoices and billing records are kept for as long as tax law requires.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <p>
        Depending on where you live, you can ask to access, correct, export or delete your personal information, or object to how we use
        it. Contact us using the details below. If your information is in an agency&apos;s workspace, we may refer your request to that
        agency. [Jurisdiction-specific rights, such as GDPR and CCPA, to be confirmed.]
      </p>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We isolate every workspace, keep files private behind expiring links and record security-relevant changes. The{" "}
        <Link href="/security">security page</Link> explains how.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Privacy questions and requests can go to <a href="mailto:privacy@atrium.example">privacy@atrium.example</a> or through the{" "}
        <Link href="/contact">contact form</Link>. [Data protection officer and EU/UK representative details, if required.]
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      eyebrow="Legal"
      title="Privacy policy"
      intro={
        <p>
          Atrium exists to help agencies share client work privately, so we try to collect as little as we can and explain plainly what
          we do with it.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
