import { routing } from '@/i18n/routing';
import type { Locale } from 'next-intl';

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ??
  `http://localhost:${process.env.PORT ?? 3001}`;

const appBaseUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  'http://localhost:3000';

export function getBaseUrl(): string {
  return baseUrl;
}

export function getAppBaseUrl(): string {
  return appBaseUrl;
}

export function shouldAppendLocale(locale?: Locale | null): boolean {
  return !!locale && locale !== routing.defaultLocale && locale !== 'default';
}

export function getUrlWithLocale(url: string, locale?: Locale | null): string {
  return shouldAppendLocale(locale)
    ? `${baseUrl}/${locale}${url}`
    : `${baseUrl}${url}`;
}

export function getAppUrlWithLocale(url: string, locale?: Locale | null): string {
  return `${appBaseUrl}${url}`;
}

export function getAppUrl(url: string): string {
  return `${appBaseUrl}${url}`;
}

export function getImageUrl(image: string): string {
  if (image.startsWith('http://') || image.startsWith('https://')) {
    return image;
  }
  return image.startsWith('/') ? `${getBaseUrl()}${image}` : `${getBaseUrl()}/${image}`;
}
