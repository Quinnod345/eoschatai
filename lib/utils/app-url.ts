import 'server-only';

const DEFAULT_APP_URL = 'http://localhost:3000';

export const getAppBaseUrl = (): string => {
  // Check various environment variables for the base URL
  const url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    DEFAULT_APP_URL;

  // Ensure the URL has a protocol
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    // In production, always use https
    const protocol = process.env.NODE_ENV === 'production' ? 'https://' : 'http://';
    return `${protocol}${url}`;
  }

  return url;
};

export const buildAppUrl = (path: string, params?: Record<string, string>): string => {
  const base = getAppBaseUrl().replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
};
