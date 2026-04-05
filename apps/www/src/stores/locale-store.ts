import type { Locale } from 'next-intl';
import { create } from 'zustand';

interface LocaleState {
  currentLocale: Locale;
  setCurrentLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  currentLocale: '' as Locale,
  setCurrentLocale: (locale) =>
    set(() => ({
      currentLocale: locale,
    })),
}));
