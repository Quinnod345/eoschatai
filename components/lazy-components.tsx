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
    import('./artifact').then((mod) => ({
      default: mod.Artifact,
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

// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used
  import('./artifact');
  import('./multimodal-input');
};
