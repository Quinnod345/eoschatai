import dynamic from 'next/dynamic';
import { LoaderIcon } from './icons';

// Loading component for lazy-loaded components
const LoadingComponent = () => (
  <div className="flex items-center justify-center p-8">
    <LoaderIcon size={24} />
  </div>
);

// Lazy load heavy components
export const LazyPersonaWizard = dynamic(
  () =>
    import('./persona-wizard').then((mod) => ({ default: mod.PersonaWizard })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazySettingsModal = dynamic(
  () =>
    import('./settings-modal').then((mod) => ({ default: mod.SettingsModal })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyDocumentContextModal = dynamic(
  () =>
    import('./document-context-modal').then((mod) => ({
      default: mod.DocumentContextModal,
    })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyArtifact = dynamic(
  () =>
    import('./composer').then((mod) => ({
      default: mod.Composer,
    })),
  {
    loading: LoadingComponent,
  },
);

export const LazyChartRenderer = dynamic(
  () =>
    import('./chart-renderer').then((mod) => ({ default: mod.ChartRenderer })),
  {
    loading: LoadingComponent,
  },
);

export const LazySpreadsheetEditor = dynamic(
  () =>
    import('./sheet-editor').then((mod) => ({
      default: mod.SpreadsheetEditor,
    })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyAdvancedSearch = dynamic(
  () =>
    import('./advanced-search').then((mod) => ({
      default: mod.AdvancedSearch,
    })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyKeyboardShortcutsModal = dynamic(
  () =>
    import('./keyboard-shortcuts-modal').then((mod) => ({
      default: mod.KeyboardShortcutsModal,
    })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyEnhancedTextEditor = dynamic(
  () =>
    import('./enhanced-text-editor').then((mod) => ({
      default: mod.EnhancedEditor,
    })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyDither = dynamic(
  () => import('./Dither').then((mod) => ({ default: mod.default })),
  {
    loading: () => <div className="w-full h-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900" />,
    ssr: false,
  },
);

export const LazyAurora = dynamic(
  () => import('./Aurora').then((mod) => ({ default: mod.default })),
  {
    loading: () => <div className="w-full h-full bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950" />,
    ssr: false,
  },
);

// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used
  import('./composer');
  import('./multimodal-input');
};
