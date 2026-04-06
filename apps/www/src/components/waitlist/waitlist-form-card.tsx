'use client';

import { subscribeWaitlistAction } from '@/actions/subscribe-waitlist';
import { FormError } from '@/components/shared/form-error';
import { FormSuccess } from '@/components/shared/form-success';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

export function WaitlistFormCard() {
  const t = useTranslations('WaitlistPage.form');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>('');
  const [success, setSuccess] = useState<string | undefined>('');

  const formSchema = z.object({
    email: z.email({ message: t('emailValidation') }),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    startTransition(async () => {
      setError('');
      setSuccess('');

      const result = await subscribeWaitlistAction({
        email: values.email,
      });

      if (result.success) {
        form.reset();
        setSuccess(t('success'));
        toast.success(t('success'));
        return;
      }

      const errorMessage = result.error || t('fail');
      setError(errorMessage);
      toast.error(errorMessage);
    });
  };

  return (
    <Card className="mx-auto max-w-lg overflow-hidden pt-6 pb-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t('email')}
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormError message={error} />
            <FormSuccess message={success} />
          </CardContent>
          <CardFooter className="mt-6 justify-between rounded-none px-6 py-4">
            <Button type="submit" disabled={isPending} className="cursor-pointer">
              {isPending ? t('subscribing') : t('subscribe')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
