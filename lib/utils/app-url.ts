import 'server-only';

const DEFAULT_APP_URL = 'http://localhost:3000';

export const getAppBaseUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    DEFAULT_APP_URL
  );
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
