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

// Voice and recording components (heavy with audio processing)
export const LazyRecordingModal = dynamic(
  () => import('./recording-modal'),
  {
    loading: () => null, // Silent loading for modals
    ssr: false,
  },
);

export const LazyVoiceMode = dynamic(
  () => import('./voice-mode'),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

export const LazyVoiceModeWebRTC = dynamic(
  () => import('./voice-mode-webrtc'),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

// Organization components (not needed on initial load)
export const LazyOrganizationModal = dynamic(
  () =>
    import('./organization-modal').then((mod) => ({
      default: mod.OrganizationModal,
    })),
  {
    loading: () => null,
    ssr: false,
  },
);

export const LazyOrganizationSettings = dynamic(
  () =>
    import('./organization-settings').then((mod) => ({
      default: mod.OrganizationSettings,
    })),
  {
    loading: LoadingComponent,
    ssr: false,
  },
);

// Persona components
export const LazyPersonaModal = dynamic(
  () =>
    import('./persona-modal').then((mod) => ({
      default: mod.PersonaModal,
    })),
  {
    loading: () => null,
    ssr: false,
  },
);

export const LazyPersonasDropdown = dynamic(
  () =>
    import('./personas-dropdown').then((mod) => ({
      default: mod.PersonasDropdown,
    })),
  {
    loading: () => (
      <div className="w-full h-10 animate-pulse bg-zinc-700/20 rounded" />
    ),
    ssr: false,
  },
);

// Premium features modal
export const LazyPremiumFeaturesModal = dynamic(
  () =>
    import('./premium-features-modal').then((mod) => ({
      default: mod.PremiumFeaturesModal,
    })),
  {
    loading: () => null,
    ssr: false,
  },
);

// Course assistant modal (heavy with course content)
export const LazyCourseAssistantModal = dynamic(
  () =>
    import('./course-assistant-modal').then((mod) => ({
      default: mod.CourseAssistantModal,
    })),
  {
    loading: () => null,
    ssr: false,
  },
);

// Preload function for critical components
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used
  import('./composer');
  import('./multimodal-input');
};

// Preload function for auth-gated components
export const preloadAuthComponents = () => {
  // Preload components needed after login
  import('./settings-modal');
  import('./persona-wizard');
};
