/**
 * Loading components index
 * 
 * Centralized exports for all loading-related components.
 * Import from '@/components/loading' for convenience.
 */

// Base skeleton
export { Skeleton } from '@/components/ui/skeleton';

// Loading spinner and utilities
export {
  LoadingSpinner,
  LoadingOverlay,
  LoadingDots,
  LoadingCard,
} from '@/components/ui/loading-spinner';

// Loading button
export { LoadingButton, type LoadingButtonProps } from '@/components/ui/loading-button';

// Comprehensive skeletons
export {
  MessageSkeleton,
  MessagesListSkeleton,
  DocumentCardSkeleton,
  DocumentListSkeleton,
  SettingsSectionSkeleton,
  SettingsFormSkeleton,
  SidebarChatItemSkeleton,
  SidebarHistorySkeleton,
  TableRowSkeleton,
  TableSkeleton,
  ProfileSkeleton,
  CardSkeleton,
  StatsCardSkeleton,
  StatsGridSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  InlineContentSkeleton,
} from '@/components/ui/skeletons';

// Settings-specific skeletons
export {
  ProfileSettingsSkeleton,
  PersonalizationSettingsSkeleton,
  OrganizationSettingsSkeleton,
  IntegrationSettingsSkeleton,
  UsageSettingsSkeleton,
  PrivacySettingsSkeleton,
  MemoriesSettingsSkeleton,
  SettingsSectionLoading,
} from '@/components/settings-skeleton';

// Document skeleton
export { DocumentSkeleton, InlineDocumentSkeleton } from '@/components/document-skeleton';

// Chat loading
export { ChatLoading } from '@/components/chat-loading';

// Global loading provider
export { LoadingProvider } from '@/components/providers/loading-provider';
