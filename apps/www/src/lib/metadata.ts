import { websiteConfig } from '@/config/website';
import { defaultMessages } from '@/i18n/messages';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getBaseUrl, getImageUrl, getUrlWithLocale } from './urls/urls';

export function constructMetadata({
  title,
  description,
  image,
  noIndex = false,
  locale,
  pathname,
  canonicalUrl,
}: {
  title?: string;
  description?: string;
  image?: string;
  noIndex?: boolean;
  locale?: Locale;
  pathname?: string;
  canonicalUrl?: string;
} = {}): Metadata {
  const resolvedTitle = title || defaultMessages.Metadata.title;
  const resolvedDescription = description || defaultMessages.Metadata.description;
  const resolvedImage = getImageUrl(image || websiteConfig.metadata.images.ogImage);
  const resolvedCanonicalUrl =
    canonicalUrl?.replace(/\/$/, '') ??
    (locale ? getUrlWithLocale(pathname || '', locale).replace(/\/$/, '') : undefined);

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: resolvedCanonicalUrl ? { canonical: resolvedCanonicalUrl } : undefined,
    openGraph: {
      type: 'website',
      locale: locale ?? 'en',
      url: resolvedCanonicalUrl,
      title: resolvedTitle,
      description: resolvedDescription,
      siteName: defaultMessages.Metadata.name,
      images: [resolvedImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedTitle,
      description: resolvedDescription,
      images: [resolvedImage],
      site: getBaseUrl(),
    },
    icons: {
      icon: '/icon.svg',
      shortcut: '/icon.svg',
    },
    metadataBase: new URL(getBaseUrl()),
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
