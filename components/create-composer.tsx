import type { Suggestion } from '@/lib/db/schema';
import type { ChatHelpers } from './multimodal-input/types';
import type { ComponentType, Dispatch, ReactNode, SetStateAction } from 'react';
import type { DataStreamDelta } from './data-stream-handler';
import type { UIComposer } from './composer';

export type ComposerActionContext<M = any> = {
  content: string;
  title?: string;
  handleVersionChange: (type: 'next' | 'prev' | 'toggle' | 'latest') => void;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  mode: 'edit' | 'diff' | 'changes';
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
};

type ComposerAction<M = any> = {
  icon: ReactNode;
  label?: string;
  description: string;
  onClick: (context: ComposerActionContext<M>) => Promise<void> | void;
  isDisabled?: (context: ComposerActionContext<M>) => boolean;
};

export type ComposerToolbarContext = {
  appendMessage: ChatHelpers['append'];
};

export type ComposerToolbarItem = {
  description: string;
  icon: ReactNode;
  onClick: (context: ComposerToolbarContext) => void;
};

interface ComposerContent<M = any> {
  title: string;
  content: string;
  mode: 'edit' | 'diff' | 'changes';
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  status: 'streaming' | 'idle';
  suggestions: Array<Suggestion>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  isInline: boolean;
  getDocumentContentById: (index: number) => string;
  isLoading: boolean;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
  documentId?: string;
}

interface InitializeParameters<M = any> {
  documentId: string;
  setMetadata: Dispatch<SetStateAction<M>>;
}

type ComposerConfig<T extends string, M = any> = {
  kind: T;
  description: string;
  content: ComponentType<ComposerContent<M>>;
  actions: Array<ComposerAction<M>>;
  toolbar: ComposerToolbarItem[];
  initialize?: (parameters: InitializeParameters<M>) => void;
  onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setComposer: Dispatch<SetStateAction<UIComposer>>;
    streamPart: DataStreamDelta;
  }) => void;
};

export class Composer<T extends string, M = any> {
  readonly kind: T;
  readonly description: string;
  readonly content: ComponentType<ComposerContent<M>>;
  readonly actions: Array<ComposerAction<M>>;
  readonly toolbar: ComposerToolbarItem[];
  readonly initialize?: (parameters: InitializeParameters) => void;
  readonly onStreamPart: (args: {
    setMetadata: Dispatch<SetStateAction<M>>;
    setComposer: Dispatch<SetStateAction<UIComposer>>;
    streamPart: DataStreamDelta;
  }) => void;

  constructor(config: ComposerConfig<T, M>) {
    this.kind = config.kind;
    this.description = config.description;
    this.content = config.content;
    this.actions = config.actions || [];
    this.toolbar = config.toolbar || [];
    this.initialize = config.initialize || (async () => ({}));
    this.onStreamPart = config.onStreamPart;
  }
}

// Backward-compatible aliases (if any legacy code still imports Artifact* types)
export type ArtifactActionContext<M = any> = ComposerActionContext<M>;
export type ArtifactToolbarContext = ComposerToolbarContext;
export type ArtifactToolbarItem = ComposerToolbarItem;
export type ArtifactContent<M = any> = ComposerContent<M>;
export type ArtifactConfig<T extends string, M = any> = ComposerConfig<T, M>;
export class Artifact<T extends string, M = any> extends Composer<T, M> {}
