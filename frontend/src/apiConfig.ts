export function getApiBaseUrl(): string {
  const customUrl = localStorage.getItem('dash_api_base_url');
  if (customUrl) return customUrl;
  const envUrl = ((import.meta as any).env?.VITE_API_BASE_URL as string) || '';
  return envUrl;
}

export function setApiBaseUrl(url: string): void {
  if (!url) {
    localStorage.removeItem('dash_api_base_url');
  } else {
    const clean = url.trim().endsWith('/') ? url.trim().slice(0, -1) : url.trim();
    localStorage.setItem('dash_api_base_url', clean);
  }
}

/**
 * Returns full API URL prepending API Base URL if set, or relative path if empty.
 * Example: getApiUrl('/api/auth/login')
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return cleanPath;
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBase}${cleanPath}`;
}
