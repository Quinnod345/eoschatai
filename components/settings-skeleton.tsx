'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const staggerContainer = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const staggerItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export function ProfileSettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-20 mb-6" /></motion.div>
      <motion.div variants={staggerItem} className="flex items-center gap-4 mb-6">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>
      </motion.div>
      <motion.div variants={staggerItem} className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-10 w-full rounded-md" /></motion.div>
      <motion.div variants={staggerItem} className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <div className="flex gap-2"><Skeleton className="h-10 flex-1 rounded-md" /><Skeleton className="h-10 w-20 rounded-md" /></div>
      </motion.div>
      <motion.div variants={staggerItem} className="pt-4 border-t space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="space-y-2"><Skeleton className="h-10 w-full rounded-md" /><Skeleton className="h-10 w-full rounded-md" /><Skeleton className="h-10 w-full rounded-md" /></div>
      </motion.div>
    </motion.div>
  );
}

export function PersonalizationSettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-36 mb-6" /></motion.div>
      {[1, 2, 3].map((i) => (
        <motion.div key={i} variants={staggerItem} className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-64" /></div>
            <Skeleton className="h-9 w-12 rounded-md" />
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export function OrganizationSettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-32 mb-6" /></motion.div>
      <motion.div variants={staggerItem} className="rounded-xl border p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-4 w-32" /></div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function IntegrationSettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-28 mb-6" /></motion.div>
      {[1, 2].map((i) => (
        <motion.div key={i} variants={staggerItem} className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-1"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-56" /></div>
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </motion.div>
      ))}
    </motion.div>
  );
}

export function UsageSettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-16 mb-6" /></motion.div>
      <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-16" /><Skeleton className="h-3 w-20" />
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export function PrivacySettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-20 mb-6" /></motion.div>
      <motion.div variants={staggerItem} className="rounded-xl border p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1"><Skeleton className="h-3 w-20" /><Skeleton className="h-6 w-12" /></div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MemoriesSettingsSkeleton() {
  return (
    <motion.div className="space-y-6" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={staggerItem}><Skeleton className="h-7 w-24 mb-6" /></motion.div>
      <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-2">
        <Skeleton className="h-10 flex-1 rounded-md" />
        <Skeleton className="h-10 w-full sm:w-40 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </motion.div>
      <motion.div variants={staggerItem} className="rounded-lg border divide-y">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 flex items-start gap-3 animate-pulse">
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-16 rounded-full" /></div>
              <Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}

export function SettingsSectionLoading({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      <Skeleton className="h-7 w-32 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full rounded-md" /></div>
        ))}
      </div>
    </div>
  );
}
