export const websiteConfig = {
  ui: {
    theme: {
      defaultTheme: 'neutral',
      enableSwitch: true,
    },
    mode: {
      defaultMode: 'light',
      enableSwitch: true,
    },
  },
  metadata: {
    images: {
      ogImage: '/icon.svg',
      logoLight: '/icon.svg',
      logoDark: '/icon.svg',
    },
    social: {
      github: 'https://github.com/OwnLabAI/ownlab',
      twitter: undefined,
      blueSky: undefined,
      discord: undefined,
      mastodon: undefined,
      linkedin: undefined,
      youtube: undefined,
      facebook: undefined,
      instagram: undefined,
      tiktok: undefined,
      telegram: undefined,
    },
  },
  routes: {
    defaultLoginRedirect: '/lab/workspaces',
  },
  features: {
    enableUpgradeCard: false,
    enableUpdateAvatar: false,
    enableAffonsoAffiliate: false,
    enablePromotekitAffiliate: false,
    enableDatafastRevenueTrack: false,
    enableCrispChat: false,
    enableTurnstileCaptcha: false,
  },
  auth: {
    enableGoogleLogin: true,
    enableGithubLogin: true,
    enableCredentialLogin: true,
  },
  blog: {
    enable: false,
    paginationSize: 6,
    relatedPostsSize: 3,
  },
  docs: {
    enable: false,
  },
  mail: {
    provider: 'resend',
    fromEmail: 'OwnLab <support@ownlab.app>',
    supportEmail: 'support@ownlab.app',
  },
  newsletter: {
    enable: false,
    provider: 'resend',
    autoSubscribeAfterSignUp: false,
  },
  storage: {
    enable: false,
    provider: 's3',
  },
  payment: {
    provider: 'stripe',
  },
  credits: {
    enableCredits: false,
    enablePackagesForFreePlan: false,
    registerGiftCredits: {
      enable: false,
      amount: 0,
      expireDays: 0,
    },
    packages: {},
  },
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: {
        flag: '🇺🇸',
        name: 'English',
      },
      zh: {
        flag: '🇨🇳',
        name: '中文',
      },
    },
  },
} as const;
