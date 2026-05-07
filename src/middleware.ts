import { NextResponse, type NextRequest } from "next/server";

export function isAuthorizedRequest(
  request: Request,
  token = process.env.INTERNAL_ACCESS_TOKEN
) {
  const normalizedToken = token?.trim();

  if (!normalizedToken) {
    return true;
  }

  return request.headers.get("authorization") === `Bearer ${normalizedToken}`;
}

export function middleware(request: NextRequest) {
  if (isAuthorizedRequest(request)) {
    return NextResponse.next();
  }

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "www-authenticate": "Bearer"
    }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
