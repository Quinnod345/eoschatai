import dynamic from 'next/dynamic';
import { LoaderIcon } from './icons';

// Loading component for lazy-loaded components
const LoadingComponent = () => (
  <div className="flex items-center justify-center p-8">
    <LoaderIcon className="h-6 w-6 animate-spin" />
  </div>
);

// Lazy load heavy components
export const LazyPersonaWizard = dynamic(() => import('./persona-wizard'), {
  loading: LoadingComponent,
  ssr: false,
});

export const LazySettingsModal = dynamic(() => import('./settings-modal'), {
  loading: LoadingComponent,
  ssr: false,
});

export const LazyDocumentContextModal = dynamic(
  () => import('./document-context-modal'),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyEnhancedArtifact = dynamic(
  () => import('./enhanced-artifact'),
  {
    loading: LoadingComponent,
  },
);

export const LazyChartRenderer = dynamic(() => import('./chart-renderer'), {
  loading: LoadingComponent,
});

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

export const LazyAdvancedSearch = dynamic(() => import('./advanced-search'), {
  loading: LoadingComponent,
  ssr: false,
});

export const LazyKeyboardShortcutsModal = dynamic(
  () => import('./keyboard-shortcuts-modal'),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used
  import('./enhanced-artifact');
  import('./multimodal-input');
};
