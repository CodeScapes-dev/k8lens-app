"use client";

import { useRouter } from "next/navigation";
import { SearchIcon, ArrowRightIcon } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { navigation } from "@/data/navigation";

export function SearchDialog({ open, onOpenChange }) {
  const router = useRouter();

  const handleSelect = (href) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-[560px] -translate-x-1/2 rounded-xl border border-border bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>

          <CommandPrimitive className="flex flex-col overflow-hidden rounded-xl">
            <div className="flex items-center gap-3 border-b border-border px-4 h-[52px] shrink-0">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input
                autoFocus
                placeholder="Search pods, deployments, services…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <CommandPrimitive.List className="max-h-[380px] overflow-y-auto overflow-x-hidden py-1">
              <CommandPrimitive.Empty className="py-10 text-center text-sm text-muted-foreground">
                No results found.
              </CommandPrimitive.Empty>

              {navigation.map((section) => (
                <CommandPrimitive.Group key={section.label}>
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {section.label}
                  </div>
                  {section.items.map((item) => (
                    <CommandPrimitive.Item
                      key={item.href}
                      value={`${section.label} ${item.label}`}
                      onSelect={() => handleSelect(item.href)}
                      className="flex items-center gap-2.5 rounded-md mx-1 px-3 py-2 text-sm text-foreground cursor-default select-none outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      {item.label}
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              ))}
            </CommandPrimitive.List>

            <div className="border-t border-border px-4 py-2.5 flex items-center gap-4 text-[11px] text-muted-foreground">
              <span><kbd className="font-sans mr-1">↑↓</kbd>navigate</span>
              <span><kbd className="font-sans mr-1">↵</kbd>go to resource</span>
              <span><kbd className="font-sans mr-1">esc</kbd>close</span>
            </div>
          </CommandPrimitive>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
