'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LibraryBig } from 'lucide-react';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

export function NavSkills() {
  const pathname = usePathname();

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      <SidebarGroup className="px-2 pt-0 pb-0 pl-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/lab/skills'}
              className="pl-3"
            >
              <Link href="/lab/skills">
                <LibraryBig className="size-4" />
                <span>Skills</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </div>
  );
}
