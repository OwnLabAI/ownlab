import 'server-only';

type SendAuthEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendAuthEmail(input: SendAuthEmailInput) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.AUTH_FROM_EMAIL?.trim() || 'OwnLab <no-reply@ownlab.app>';

  if (!apiKey) {
    console.log(`[ownlab-www] auth email skipped (${input.subject}) -> ${input.to}`);
    console.log(input.text);
    return;
  }

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
