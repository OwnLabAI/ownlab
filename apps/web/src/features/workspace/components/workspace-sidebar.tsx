'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PanelRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarContent, SidebarHeader } from '@/components/ui/sidebar';
import { NavNew } from './nav-new';
import { WorkspaceNavItems } from './workspace-nav-items';
import { WorkspaceSwitcher } from './workspace-switcher';
import type { Item } from '@/features/workspace/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

interface WorkspaceSidebarProps {
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  onCollapse?: () => void;
}

export function WorkspaceSidebar({
  items: initialItems,
  workspaces,
  onCollapse,
}: WorkspaceSidebarProps) {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const isValid = !!workspaceId;

  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleItemCreated = (newItem: Item) => {
    setItems((prev) => [...prev, newItem]);
  };

  return (
    <div className="border-l h-full w-full flex flex-col bg-sidebar">
      <div className="flex h-10 items-center justify-between shrink-0 px-3">
        <Link href="/lab/workspaces">
          <img
            src="/logo-name.svg"
            alt="OwnLab"
            className="h-5 w-auto"
          />
        </Link>
        {onCollapse && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <SidebarHeader className="p-0">
        <WorkspaceSwitcher workspaces={workspaces} />
        {isValid && (
          <NavNew
            workspaceId={workspaceId}
            onItemCreated={handleItemCreated}
          />
        )}
      </SidebarHeader>

      <SidebarContent className="w-full overflow-auto">
        {isValid && (
          <WorkspaceNavItems
            items={items}
            onItemDeleted={() => router.refresh()}
            onItemUpdated={() => router.refresh()}
          />
        )}
      </SidebarContent>
    </div>
  );
}
