import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

// The public chat API authenticates via Bearer token, NOT Clerk — exclude it
// from Clerk's auth machinery. We also short-circuit OPTIONS so cross-origin
// browser preflights don't spend a Clerk request.
const isPublicApiRoute = createRouteMatcher(['/api/v1/(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicApiRoute(req)) {
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(req.headers.get('origin')),
      });
    }
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

function corsHeaders(origin: string | null): Record<string, string> {
  // Per-token origin allow-listing happens in the route handler; the middleware
  // just needs to let the preflight succeed. The route handler echoes the real
  // allowed origin once it has loaded the token.
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
