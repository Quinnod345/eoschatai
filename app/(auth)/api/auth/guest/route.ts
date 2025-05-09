import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Instead of creating a guest user, redirect to login page
  return NextResponse.redirect(new URL('/login', request.url));
}
