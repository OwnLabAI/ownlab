import { constructMetadata } from '@/lib/metadata';
import { getUrlWithLocale } from '@/lib/urls/urls';
import type { Metadata } from 'next';
import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata | undefined> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });

  return constructMetadata({
    title: 'Privacy Policy | ' + t('title'),
    description: t('description'),
    locale,
    pathname: '/privacy',
    canonicalUrl: getUrlWithLocale('/privacy', locale),
  });
}

export default async function PrivacyPolicyPage() {
  return (
    <article className="prose prose-neutral max-w-3xl dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p>
        OwnLab is preparing the hosted account surface. This page will be
        expanded as that surface ships.
      </p>
      <p>
        For now, assume that local workspace execution remains local-first and
        account features are limited to hosted entry access.
      </p>
    </article>
  );
}
