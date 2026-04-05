import FaqSection from '@/components/blocks/faqs';
import FeaturesSection from '@/components/blocks/features';
import HeroSection from '@/components/blocks/hero';
import { constructMetadata } from '@/lib/metadata';
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
    title: t('title'),
    description: t('description'),
    locale,
    pathname: '',
  });
}

interface HomePageProps {
  params: Promise<{ locale: Locale }>;
}

export default async function HomePage(props: HomePageProps) {
  const params = await props.params;
  const { locale } = params;
  await getTranslations({ locale, namespace: 'HomePage' });

  return (
    <div className="flex flex-col">
      <HeroSection />
      <FeaturesSection />
      <FaqSection />
    </div>
  );
}
