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
    title: 'Terms of Service | ' + t('title'),
    description: t('description'),
    locale,
    pathname: '/terms',
    canonicalUrl: getUrlWithLocale('/terms', locale),
  });
}

export default async function TermsOfServicePage() {
  return (
    <article className="prose prose-neutral max-w-3xl dark:prose-invert">
      <h1>Terms of Service</h1>
      <p>
        OwnLab hosted entry is in active migration. These placeholder terms
        will be replaced by the product terms for hosted accounts and device
        connection flows.
      </p>
      <p>Current product behavior remains centered on local-first runtime execution.</p>
    </article>
  );
}
