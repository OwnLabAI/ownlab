import 'server-only';

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sendAuthEmail } from './auth-email';
import { getAuthDb } from './auth-db';
import { getAppBaseUrl, getBaseUrl } from './urls/urls';

let authPromise: Promise<any> | null = null;

export async function getAuth() {
  if (!authPromise) {
    authPromise = (async () =>
      betterAuth({
        secret: process.env.BETTER_AUTH_SECRET ?? 'ownlab-www-dev-secret',
        baseURL: getBaseUrl(),
        basePath: '/api/auth',
        appName: 'OwnLab',
        trustedOrigins: [getAppBaseUrl()],
        database: drizzleAdapter(await getAuthDb(), {
          provider: 'pg',
        }),
        session: {
          cookieCache: {
            enabled: true,
            maxAge: 60 * 5,
          },
          expiresIn: 60 * 60 * 24 * 7,
          updateAge: 60 * 60 * 24,
        },
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: false,
          async sendResetPassword({ user, url }) {
            await sendAuthEmail({
              to: user.email,
              subject: 'Reset your OwnLab password',
              text: `Reset your OwnLab password: ${url}`,
              html: `<p>Reset your OwnLab password:</p><p><a href="${url}">${url}</a></p>`,
            });
          },
        },
        socialProviders: {
          ...(process.env.GITHUB_CLIENT_ID?.trim() &&
          process.env.GITHUB_CLIENT_SECRET?.trim()
            ? {
                github: {
                  clientId: process.env.GITHUB_CLIENT_ID,
                  clientSecret: process.env.GITHUB_CLIENT_SECRET,
                },
              }
            : {}),
          ...(process.env.GOOGLE_CLIENT_ID?.trim() &&
          process.env.GOOGLE_CLIENT_SECRET?.trim()
            ? {
                google: {
                  clientId: process.env.GOOGLE_CLIENT_ID,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                },
              }
            : {}),
        },
        onAPIError: {
          errorURL: '/auth/error',
          onError(error) {
            console.error('[ownlab-www] auth error:', error);
          },
        },
      }))();
  }

  return authPromise;
}
