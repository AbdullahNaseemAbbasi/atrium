import { z } from "zod";

/**
 * Server-side validation schemas. Client forms mirror these rules for
 * usability, but these are the ones that decide.
 */

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .refine((value) => !value || !Number.isNaN(Date.parse(value)), "Enter a valid date.");

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((value) => value === "on" || value === "true");

export const projectSchema = z
  .object({
    name: z.string().trim().min(3, "Use at least 3 characters.").max(80, "Keep it under 80 characters."),
    description: z.string().trim().max(600, "Keep the description under 600 characters.").default(""),
    clientId: z.string().trim().optional().transform((value) => (value ? value : null)),
    status: z.enum(["planning", "in_progress", "in_review", "on_hold", "completed", "cancelled"]).default("planning"),
    icon: z.enum(["globe", "smartphone", "palette", "cart", "megaphone", "heart", "search", "layers"]).default("layers"),
    startAt: optionalDate,
    dueAt: optionalDate,
    leadId: z.string().trim().min(1, "Choose a project lead."),
    memberIds: z.array(z.string()).default([]),
    sharedWithClient: checkbox,
    budget: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? Number(value.replace(/[,$\s]/g, "")) : undefined))
      .refine((value) => value === undefined || (Number.isFinite(value) && value >= 0 && value <= 10_000_000), "Enter a budget between 0 and 10,000,000."),
  })
  .refine((value) => !value.startAt || !value.dueAt || Date.parse(value.dueAt) >= Date.parse(value.startAt), {
    message: "The due date must be on or after the start date.",
    path: ["dueAt"],
  })
  .refine((value) => !value.sharedWithClient || value.clientId, {
    message: "Pick a client before sharing the project.",
    path: ["sharedWithClient"],
  });

export const taskSchema = z.object({
  title: z.string().trim().min(2, "Give the task a title.").max(140),
  description: z.string().trim().max(2000).optional().transform((value) => value || undefined),
  status: z.enum(["todo", "in_progress", "in_review", "blocked", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueAt: optionalDate,
  assigneeId: z.string().trim().optional().transform((value) => value || undefined),
  milestoneId: z.string().trim().optional().transform((value) => value || undefined),
  clientVisible: checkbox,
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first.").max(4000, "Keep comments under 4,000 characters."),
  visibility: z.enum(["internal", "client"]).default("client"),
});

/** Allowed upload types. Executables and scripts are rejected outright. */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "video/quicktime",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
] as const;

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "gif", "svg", "mp4", "mov", "zip", "xlsx", "docx", "pptx", "txt", "csv"];

export const MAX_UPLOAD_BYTES = 5 * 1024 ** 3;

export const uploadSchema = z
  .object({
    fileName: z.string().trim().min(1, "Choose a file to upload.").max(180, "File name is too long."),
    mimeType: z.string().trim(),
    sizeBytes: z.coerce.number().int().positive("The file is empty.").max(MAX_UPLOAD_BYTES, "Files can be up to 5 GB."),
    note: z.string().trim().max(500).optional().transform((value) => value || undefined),
  })
  .refine((value) => ALLOWED_EXTENSIONS.includes(value.fileName.split(".").pop()?.toLowerCase() ?? ""), {
    message: "This file type isn't allowed. Use PDF, images, video, ZIP or Office documents.",
    path: ["fileName"],
  })
  .refine((value) => (ALLOWED_MIME_TYPES as readonly string[]).includes(value.mimeType) || value.mimeType === "", {
    message: "This file type isn't allowed.",
    path: ["fileName"],
  });

export const deliverableSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters.").max(120),
  description: z.string().trim().max(1000).optional().transform((value) => value || undefined),
  milestoneId: z.string().trim().optional().transform((value) => value || undefined),
});

export const decisionSchema = z
  .object({
    decision: z.enum(["approved", "changes_requested"]),
    version: z.coerce.number().int().positive(),
    comment: z.string().trim().max(2000).optional().transform((value) => value || undefined),
  })
  .refine((value) => value.decision === "approved" || (value.comment && value.comment.length >= 5), {
    message: "Tell the team what to change (at least a short sentence).",
    path: ["comment"],
  });
