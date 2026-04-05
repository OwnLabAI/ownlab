import { websiteConfig } from './config/website';

/**
 * The routes for the application
 */
export enum Routes {
  Root = '/',

  // marketing pages
  FAQ = '/#faqs',
  Features = '/#features',
  Pricing = '/#pricing',
  Blog = '/blog',
  Docs = 'https://github.com/OwnLabAI/ownlab#readme',
  About = '/',
  Contact = '/auth/register',
  Waitlist = '/auth/register',
  Changelog = 'https://github.com/OwnLabAI/ownlab/releases',
  Roadmap = 'https://github.com/OwnLabAI/ownlab',
  CookiePolicy = '/cookie',
  PrivacyPolicy = '/privacy',
  TermsOfService = '/terms',

  // auth routes
  Login = '/auth/login',
  Register = '/auth/register',
  AuthError = '/auth/error',
  ForgotPassword = '/auth/forgot-password',
  ResetPassword = '/auth/reset-password',

  // dashboard routes
  Dashboard = '/dashboard',
  AdminUsers = '/admin/users',
  SettingsProfile = '/settings/profile',
  SettingsBilling = '/settings/billing',
  SettingsCredits = '/settings/credits',
  SettingsSecurity = '/settings/security',
  SettingsNotifications = '/settings/notifications',

  // payment processing
  Payment = '/payment',

  // lab routes
  Lab = '/lab/workspaces',

  // AI routes (marketing demos)
  AIVideo = '/ai/video',
  AIAudio = '/ai/audio',

  // block routes
  MagicuiBlocks = '/magicui',
  HeroBlocks = '/blocks/hero-section',
  LogoCloudBlocks = '/blocks/logo-cloud',
  FeaturesBlocks = '/blocks/features',
  IntegrationsBlocks = '/blocks/integrations',
  ContentBlocks = '/blocks/content',
  StatsBlocks = '/blocks/stats',
  TeamBlocks = '/blocks/team',
  TestimonialsBlocks = '/blocks/testimonials',
  CallToActionBlocks = '/blocks/call-to-action',
  FooterBlocks = '/blocks/footer',
  PricingBlocks = '/blocks/pricing',
  ComparatorBlocks = '/blocks/comparator',
  FAQBlocks = '/blocks/faqs',
  LoginBlocks = '/blocks/login',
  SignupBlocks = '/blocks/sign-up',
  ForgotPasswordBlocks = '/blocks/forgot-password',
  ContactBlocks = '/blocks/contact',
}

/**
 * The routes that can not be accessed by logged in users
 */
export const routesNotAllowedByLoggedInUsers = [Routes.Login, Routes.Register];

/**
 * The routes that are protected and require authentication
 */
export const protectedRoutes = [
  Routes.Lab,
  Routes.AdminUsers,
  Routes.SettingsProfile,
  Routes.SettingsBilling,
  Routes.SettingsCredits,
  Routes.SettingsSecurity,
  Routes.SettingsNotifications,
  Routes.Payment,
];

/**
 * The default redirect path after logging in
 */
export const DEFAULT_LOGIN_REDIRECT =
  websiteConfig.routes.defaultLoginRedirect ?? Routes.Lab;
