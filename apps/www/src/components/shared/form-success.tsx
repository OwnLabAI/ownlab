import { CircleCheckIcon } from 'lucide-react';

interface FormSuccessProps {
  message?: string;
}

export const FormSuccess = ({ message }: FormSuccessProps) => {
  if (!message) return null;

  return (
    <div className="bg-muted text-foreground flex items-center gap-x-2 rounded-md border border-border/60 p-3 text-sm">
      <CircleCheckIcon className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
};
