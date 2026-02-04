'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { motion } from 'framer-motion';

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export function MessageSkeleton({ isUser = false, className }: { isUser?: boolean; className?: string }) {
  return (
    <div className={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : '', className)}>
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className={cn('flex flex-col gap-2 flex-1 max-w-[80%]', isUser ? 'items-end' : '')}>
        <Skeleton className="h-4 w-24" />
        <div className="space-y-2 w-full">
          <Skeleton className={cn('h-4', isUser ? 'w-3/4 ml-auto' : 'w-full')} />
          <Skeleton className={cn('h-4', isUser ? 'w-1/2 ml-auto' : 'w-5/6')} />
          <Skeleton className={cn('h-4', isUser ? 'w-2/3 ml-auto' : 'w-2/3')} />
        </div>
      </div>
    </div>
  );
}

export function MessagesListSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <motion.div className={cn('space-y-4', className)} variants={staggerContainer} initial="hidden" animate="show">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={staggerItem}><MessageSkeleton isUser={i % 2 === 1} /></motion.div>
      ))}
    </motion.div>
  );
}

export function DocumentCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Skeleton className="h-10 w-10 rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <Skeleton className="h-4 w-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function DocumentListSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <motion.div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)} variants={staggerContainer} initial="hidden" animate="show">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={staggerItem}><DocumentCardSkeleton /></motion.div>
      ))}
    </motion.div>
  );
}

export function SettingsSectionSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <Skeleton className="h-7 w-40" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SettingsFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <Skeleton className="h-7 w-32" />
      <div className="space-y-4">
        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full rounded-md" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full rounded-md" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-24 w-full rounded-md" /></div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}

export function SidebarChatItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-md h-9 flex gap-2 px-2 items-center bg-sidebar-accent/30', className)}>
      <Skeleton className="h-4 flex-1 max-w-[80%] bg-sidebar-accent-foreground/10" />
    </div>
  );
}

export function SidebarHistorySkeleton({ count = 5, className }: { count?: number; className?: string }) {
  const widths = [44, 32, 28, 64, 52, 40, 58, 35];
  return (
    <motion.div className={cn('flex flex-col gap-2', className)} variants={staggerContainer} initial="hidden" animate="show">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={staggerItem} className="rounded-md h-9 flex gap-2 px-2 items-center bg-sidebar-accent/30 border border-transparent">
          <div className="h-4 rounded-md flex-1 bg-sidebar-accent-foreground/10 animate-pulse" style={{ maxWidth: `${widths[i % widths.length]}%` }} />
        </motion.div>
      ))}
    </motion.div>
  );
}

export function TableRowSkeleton({ columns = 4, className }: { columns?: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-4 py-3 px-4', className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-10' : i === columns - 1 ? 'w-20' : 'flex-1')} />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5, columns = 4, className }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border divide-y', className)}>
      <div className="flex items-center gap-4 py-3 px-4 bg-muted/50">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className={cn('h-4', i === 0 ? 'w-10' : i === columns - 1 ? 'w-20' : 'flex-1')} />
        ))}
      </div>
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div key={i} variants={staggerItem}><TableRowSkeleton columns={columns} /></motion.div>
        ))}
      </motion.div>
    </div>
  );
}

export function ProfileSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-24" /></div>
      </div>
      <div className="space-y-4">
        <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full rounded-md" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-10 w-full rounded-md" /></div>
      </div>
    </div>
  );
}

export function CardSkeleton({ hasImage = false, hasFooter = true, className }: { hasImage?: boolean; hasFooter?: boolean; className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)}>
      {hasImage && <Skeleton className="h-40 w-full" />}
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {hasFooter && <div className="px-4 pb-4 flex items-center gap-2"><Skeleton className="h-8 w-20 rounded-md" /><Skeleton className="h-8 w-20 rounded-md" /></div>}
    </div>
  );
}

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-2', className)}>
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function StatsGridSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {Array.from({ length: count }).map((_, i) => <StatsCardSkeleton key={i} />)}
    </div>
  );
}

export function PageHeaderSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-5 w-96" />
    </div>
  );
}

export function PageSkeleton({ hasHeader = true, hasStats = false, className }: { hasHeader?: boolean; hasStats?: boolean; className?: string }) {
  return (
    <div className={cn('space-y-6 p-6', className)}>
      {hasHeader && <PageHeaderSkeleton />}
      {hasStats && <StatsGridSkeleton />}
      <div className="grid gap-4 md:grid-cols-2"><CardSkeleton /><CardSkeleton /></div>
      <TableSkeleton />
    </div>
  );
}

export function InlineContentSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ['100%', '85%', '70%', '90%', '60%', '80%'];
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4" style={{ width: widths[i % widths.length] }} />
      ))}
    </div>
  );
}
