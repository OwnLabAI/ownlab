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
    title: 'Cookie Policy | ' + t('title'),
    description: t('description'),
    locale,
    pathname: '/cookie',
    canonicalUrl: getUrlWithLocale('/cookie', locale),
  });
}

export default async function CookiePolicyPage() {
  return (
    <article className="prose prose-neutral max-w-3xl dark:prose-invert">
      <h1>Cookie Policy</h1>
      <p>
        OwnLab currently uses a minimal hosted entry surface. Cookie behavior
        for production auth flows will be documented here as the hosted account
        layer is completed.
      </p>
    </article>
  );
}
