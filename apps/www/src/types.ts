import type { ReactNode } from 'react';

export type MenuItem = {
  title: string;
  href?: string;
  external?: boolean;
  icon?: ReactNode;
  description?: string;
};

export type NestedMenuItem = MenuItem & {
  items?: MenuItem[];
};
