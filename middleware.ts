import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

export function middleware(request: NextRequest) {
  const basicAuthUser = process.env.BASIC_AUTH_USER;
  const basicAuthPassword = process.env.BASIC_AUTH_PASSWORD;

  // If Basic Auth is not configured, allow all requests (development mode)
  if (!basicAuthUser || !basicAuthPassword) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const authValue = authHeader.split(" ")[1];
    if (authValue) {
      try {
        const [user, password] = atob(authValue).split(":");
        if (user === basicAuthUser && password === basicAuthPassword) {
          return NextResponse.next();
        }
      } catch {
        // Invalid base64, fall through to 401
      }
    }
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AI Coding Agent", charset="UTF-8"',
    },
  });
}
