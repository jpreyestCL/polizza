import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Verificación optimista de sesión: comprueba la cookie antes de servir rutas
 * protegidas. La autorización real (rol, organización) ocurre en el servidor
 * vía requireSession().
 */
export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (sessionCookie) {
    return NextResponse.next();
  }
  // Construye el destino desde los headers reenviados por el proxy para
  // que el redirect use el dominio público y no la dirección interna.
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.host;
  const proto =
    request.headers.get("x-forwarded-proto") ??
    request.nextUrl.protocol.replace(":", "");
  const loginUrl = new URL("/login", `${proto}://${host}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|registro|aceptar-invitacion).*)",
  ],
};
