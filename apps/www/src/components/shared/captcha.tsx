'use client';

import { FormMessage } from '@/components/ui/form';
import { websiteConfig } from '@/config/website';
import { type ComponentProps, forwardRef } from 'react';

type Props = Omit<ComponentProps<'div'>, 'onError'> & {
  validationError?: string;
  onSuccess?: (token: string) => void;
};

export const Captcha = forwardRef<HTMLDivElement, Props>(
  ({ validationError, ...props }, ref) => {
    const turnstileEnabled = websiteConfig.features.enableTurnstileCaptcha;

    if (!turnstileEnabled) {
      return null;
    }

    return (
      <div ref={ref} {...props}>
        <FormMessage className="mt-2 text-red-500">
          {validationError || 'Captcha is not configured yet.'}
        </FormMessage>
      </div>
    );
  }
);

Captcha.displayName = 'Captcha';
