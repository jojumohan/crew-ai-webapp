const defaultAppUrl = 'https://crew-ai-webapp.vercel.app';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function getConfiguredAppUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  return defaultAppUrl;
}

export function getSignOutCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return `${getConfiguredAppUrl()}/login`;
  }

  const currentOrigin = trimTrailingSlash(window.location.origin);
  const currentHost = window.location.hostname;

  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return `${currentOrigin}/login`;
  }

  const configuredAppUrl = getConfiguredAppUrl();
  const configuredHost = new URL(configuredAppUrl).hostname;

  if (currentHost === configuredHost) {
    return `${currentOrigin}/login`;
  }

  return `${configuredAppUrl}/login`;
}
