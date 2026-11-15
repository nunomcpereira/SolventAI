import { exportCurrentDatabase, restoreCurrentDatabase } from "../../../lib/services/backupService.js";
import { MAX_BACKUP_BYTES } from "../../../lib/db/backup.js";

export const dynamic = "force-dynamic";

/** GET: download a full copy of the current profile's database. */
export async function GET(): Promise<Response> {
  const { fileName, bytes } = await exportCurrentDatabase();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

/**
 * A restore overwrites all data, so refuse anything not sent by this app's own page.
 * Without this, any website open in the same browser could POST a form to
 * localhost and replace the user's database (classic CSRF).
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** POST (multipart, field "file"): replace the current profile's database with a backup. */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return Response.json({ ok: false, error: "forbidden" }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BACKUP_BYTES + 64 * 1024) return Response.json({ ok: false, error: "too-large" }, { status: 413 });

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ ok: false, error: "not-sqlite" }, { status: 400 });
  }
  if (!(file instanceof File)) return Response.json({ ok: false, error: "not-sqlite" }, { status: 400 });

  const result = await restoreCurrentDatabase(new Uint8Array(await file.arrayBuffer()));
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
