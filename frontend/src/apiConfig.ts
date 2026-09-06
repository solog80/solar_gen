export const API_BASE_URL = ((import.meta as any).env?.VITE_API_BASE_URL as string) || '';

/**
 * Returns full API URL prepending VITE_API_BASE_URL if set, or relative path if empty.
 * Example: getApiUrl('/api/auth/login')
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${baseUrl}${cleanPath}`;
}
