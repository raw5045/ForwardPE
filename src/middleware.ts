import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedRequest } from "./lib/auth/internal";

export { isAuthorizedRequest };

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
