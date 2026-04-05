'use client';

import { getAppUrl } from '@/lib/urls/urls';
import type { MenuItem } from '@/types';
import {
  CreditCardIcon,
  LayoutDashboardIcon,
  Settings2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Get avatar config with translations
 *
 * NOTICE: used in client components only
 *
 * docs:
 * https://mksaas.com/docs/config/avatar
 *
 * @returns The avatar config with translated titles
 */
export function useAvatarLinks(): MenuItem[] {
  const t = useTranslations('Marketing.avatar');

  return [
    {
      title: t('lab'),
      href: getAppUrl('/lab/workspaces'),
      icon: <LayoutDashboardIcon className="size-4 shrink-0" />,
      external: true,
    },
    {
      title: t('billing'),
      href: getAppUrl('/lab/workspaces'),
      icon: <CreditCardIcon className="size-4 shrink-0" />,
      external: true,
    },
    {
      title: t('settings'),
      href: getAppUrl('/lab/workspaces'),
      icon: <Settings2Icon className="size-4 shrink-0" />,
      external: true,
    },
  ];
}
