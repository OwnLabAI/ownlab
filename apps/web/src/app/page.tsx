import { redirect } from 'next/navigation';

/** First-time entry: send users to /lab (landing), not /lab/workspaces. */
export default function HomePage() {
  redirect('/lab');
}
