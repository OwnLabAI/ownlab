'use server';

import { z } from 'zod';

const captchaSchema = z.object({
  captchaToken: z.string().min(1, { error: 'Captcha token is required' }),
});

export async function validateCaptchaAction(input: { captchaToken: string }) {
  const parsed = captchaSchema.safeParse(input);

  if (!parsed.success) {
    return {
      data: {
        success: false,
        valid: false,
        error: 'Captcha token is required',
      },
    };
  }

  return {
    data: {
      success: true,
      valid: true,
    },
  };
}
