import { NextResponse, type NextRequest } from "next/server";
import { BEFORE_HEADER, BEFORE_PARAM, parseBefore } from "./lib/history/versionParam.js";

/** Forwards `?before=` as a request header (and strips any client-sent copy of it). */
export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(BEFORE_HEADER);
  const before = parseBefore(request.nextUrl.searchParams.get(BEFORE_PARAM));
  if (before) headers.set(BEFORE_HEADER, before);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/|api/|favicon).*)"] };
