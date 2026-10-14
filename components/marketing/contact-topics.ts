export const CONTACT_TOPICS = [
  { value: "sales", label: "Plans and pricing" },
  { value: "support", label: "Help with my workspace" },
  { value: "billing", label: "Billing or invoices" },
  { value: "security", label: "Security report" },
  { value: "other", label: "Something else" },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]["value"];

export function parseContactTopic(value: unknown): ContactTopic | undefined {
  return CONTACT_TOPICS.find((topic) => topic.value === value)?.value;
}
