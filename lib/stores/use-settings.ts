import { create } from 'zustand';

type SettingsState = {
  useCodeInterpreterForSpreadsheets: boolean;
  setUseCodeInterpreterForSpreadsheets: (value: boolean) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  useCodeInterpreterForSpreadsheets: false,
  setUseCodeInterpreterForSpreadsheets: (value) =>
    set({ useCodeInterpreterForSpreadsheets: Boolean(value) }),
}));
