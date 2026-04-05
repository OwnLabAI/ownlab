'use client';

import Container from '@/components/layout/container';
import { Logo } from '@/components/layout/logo';
import BuiltWithButton from '@/components/shared/built-with-button';
import { useFooterLinks } from '@/config/footer-config';
import { useSocialLinks } from '@/config/social-config';
import { websiteConfig } from '@/config/website';
import { LocaleLink } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import type React from 'react';

export function Footer({ className }: React.HTMLAttributes<HTMLElement>) {
  const t = useTranslations();
  const footerLinks = useFooterLinks();
  const socialLinks = useSocialLinks();

  return (
    <footer className={cn('border-t', className)}>
      <Container className="px-4">
        <div className="grid gap-12 pt-12 pb-8 md:grid-cols-5">
          {/* Logo and brand section */}
          <div className="md:col-span-2">
            <div className="space-y-4">
              {/* logo and name */}
              <div className="items-center space-x-2 flex">
                <Logo />
                <span className="text-xl font-semibold">
                  {t('Metadata.name')}
                </span>
              </div>

              {/* tagline */}
              <p className="text-muted-foreground text-base">
                {t('Marketing.footer.tagline')}
              </p>

              {/* social links */}
              <div className="flex items-center gap-2 pt-2">
                {socialLinks?.map((link) => (
                  <a
                    key={link.title}
                    href={link.href || '#'}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={link.title}
                    className="border border-border inline-flex h-8 w-8 items-center
                        justify-center rounded-full hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <span className="sr-only">{link.title}</span>
                    {link.icon ? link.icon : null}
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Footer links - multi-column */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 md:col-span-3">
            {footerLinks?.map((section) => (
              <div key={section.title} className="space-y-4">
                <span className="block text-sm font-semibold">
                  {section.title}
                </span>
                <ul className="space-y-3">
                  {section.items?.map(
                    (item) =>
                      item.href && (
                        <li key={item.title}>
                          <LocaleLink
                            href={item.href || '#'}
                            target={item.external ? '_blank' : undefined}
                            className="text-sm text-muted-foreground hover:text-primary transition-colors block"
                          >
                            {item.title}
                          </LocaleLink>
                        </li>
                      )
                  )}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
