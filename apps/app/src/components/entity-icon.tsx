'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

type Props = {
  icon: string | null | undefined;
  name: string;
  fallback?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

function isImageIcon(icon: string | null | undefined) {
  if (!icon) return false;
  return /^(https?:|data:image\/|blob:|\/)/.test(icon);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? '?';
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
}

export function EntityIcon({
  icon,
  name,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
}: Props) {
  const imageUrl = isImageIcon(icon) ? icon : null;
  const fallbackText = imageUrl ? (fallback ?? getInitials(name)) : (icon || fallback || getInitials(name));

  return (
    <Avatar className={cn('size-8 rounded-lg', className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={name} className={imageClassName} /> : null}
      <AvatarFallback className={cn('rounded-lg text-xs', fallbackClassName)}>
        {fallbackText}
      </AvatarFallback>
    </Avatar>
  );
}
