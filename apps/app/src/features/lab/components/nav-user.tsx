'use client';

import { authClient } from '@/lib/auth-client';
import { getWwwUrl } from '@/lib/urls';
import {
  ChevronsUpDown,
  Home,
  LaptopIcon,
  LogOut,
  MoonIcon,
  Settings,
  SunIcon,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { ThemeSwitcher } from './theme-switcher';

export function NavUser({
  user,
  isLoading = false,
  isAuthenticated = false,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  isLoading?: boolean;
  isAuthenticated?: boolean;
}) {
  const { isMobile } = useSidebar();

  const handleSignOut = async () => {
    await authClient.signOut();
    window.location.assign(getWwwUrl('/'));
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger id="lab-user-menu-trigger" asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {(isLoading ? '...' : user.name)?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {isLoading ? 'Loading session...' : user.name}
                </span>
                <span className="truncate text-xs">
                  {isLoading
                    ? 'Checking hosted account'
                    : user.email || (isAuthenticated ? '' : 'Not signed in')}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="start"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {(isLoading ? '...' : user.name)?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {isLoading ? 'Loading session...' : user.name}
                  </span>
                  <span className="truncate text-xs">
                    {isLoading
                      ? 'Checking hosted account'
                      : user.email || (isAuthenticated ? '' : 'Not signed in')}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <div className="px-1 py-1.5">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <SunIcon className="size-3.5" />
                  <MoonIcon className="size-3.5" />
                  <LaptopIcon className="size-3.5" />
                  <span>Appearance</span>
                </div>
                <ThemeSwitcher />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={getWwwUrl('/')}>
                  <Home />
                  Homepage
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings />
                Settings
              </DropdownMenuItem>
              {isAuthenticated && (
                <DropdownMenuItem
                  onSelect={(event) => event.preventDefault()}
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
