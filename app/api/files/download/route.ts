import { NextResponse, type NextRequest } from "next/server";
import { readSessionUserId } from "@/lib/auth/session";
import {
  canViewDeliverable,
  canViewProject,
  resolveClientContext,
  resolveTeamContext,
} from "@/lib/data/access";
import { getDb } from "@/lib/data/store";
import { verifyDownload } from "@/lib/storage/signed-urls";

/**
 * Serves a file for a valid, unexpired download token. Access is checked a
 * second time here because the user's role could have changed after the link
 * was issued. In the demo build the "file" is a generated placeholder; with
 * Supabase this route redirects to a storage signed URL instead.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const claims = verifyDownload(token);
  if (!claims) return NextResponse.json({ error: "This download link has expired. Request a new one." }, { status: 410 });

  const userId = await readSessionUserId();
  if (!userId || userId !== claims.userId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const ctx = resolveTeamContext(db, userId, claims.orgSlug) ?? resolveClientContext(db, userId, claims.orgSlug);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let fileName: string;
  let description: string;
  if (claims.kind === "version") {
    const version = db.deliverableVersions.find((item) => item.id === claims.objectId && item.organizationId === ctx.org.id);
    const deliverable = version && db.deliverables.find((item) => item.id === version.deliverableId);
    if (!version || !deliverable || !canViewDeliverable(db, ctx, deliverable)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    fileName = version.fileName;
    description = `${deliverable.title}, version ${version.version}`;
  } else {
    const file = db.files.find((item) => item.id === claims.objectId && item.organizationId === ctx.org.id);
    const project = file && db.projects.find((item) => item.id === file.projectId);
    if (!file || !project || !canViewProject(db, ctx, project) || (ctx.kind === "client" && file.visibility !== "client")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    fileName = file.name;
    description = `${project.name} project file`;
  }

  const body = [
    "Atrium demo download",
    "",
    `File: ${fileName}`,
    `Item: ${description}`,
    `Workspace: ${ctx.org.name}`,
    "",
    "This placeholder stands in for the real file. In production the same",
    "authorization runs and the browser is redirected to a private storage",
    "object through a URL that expires after 60 seconds.",
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Force download and never let the browser render untrusted content inline.
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.\- ]/g, "_")}.txt"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
