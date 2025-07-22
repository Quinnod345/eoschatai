import { create } from 'zustand';

interface LoadingState {
  isLoading: boolean;
  loadingText: string;
  loadingType: 'default' | 'chat' | 'search' | 'upload' | 'processing';
  setLoading: (
    loading: boolean,
    text?: string,
    type?: LoadingState['loadingType'],
  ) => void;
}

export const useLoading = create<LoadingState>((set) => ({
  isLoading: false,
  loadingText: 'Loading...',
  loadingType: 'default',
  setLoading: (loading, text = 'Loading...', type = 'default') =>
    set({ isLoading: loading, loadingText: text, loadingType: type }),
}));
