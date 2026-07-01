export { auth as middleware } from "@/auth";

export const config = {
  // Protect everything except the auth endpoints, the sign-in page, and static assets.
  matcher: ["/((?!api/auth|signin|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.ico).*)"],
};
