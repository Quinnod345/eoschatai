'use client';

import { useEffect } from 'react';
import { useUserSettings } from './user-settings-provider';

/**
 * Component that manages global visual effects based on user settings
 * Sets data attributes on the HTML element to control CSS-based effects
 */
export function SettingsEffectsManager() {
  const { settings, loading } = useUserSettings();

  useEffect(() => {
    try {
      if (loading) {
        console.log('[SettingsEffectsManager] Loading settings...');
        return;
      }

      console.log('[SettingsEffectsManager] Settings:', {
        disableGlassEffects: settings?.disableGlassEffects,
        disableEosGradient: settings?.disableEosGradient,
      });

      const html = document.documentElement;
      
      // Manage glass effects attribute
      if (settings?.disableGlassEffects ?? true) {
        console.log('[SettingsEffectsManager] Setting data-glass-effects=disabled');
        html.setAttribute('data-glass-effects', 'disabled');
      } else {
        console.log('[SettingsEffectsManager] Removing data-glass-effects');
        html.removeAttribute('data-glass-effects');
      }

      // Manage gradient effects attribute
      if (settings?.disableEosGradient ?? true) {
        console.log('[SettingsEffectsManager] Setting data-eos-gradients=disabled');
        html.setAttribute('data-eos-gradients', 'disabled');
      } else {
        console.log('[SettingsEffectsManager] Removing data-eos-gradients');
        html.removeAttribute('data-eos-gradients');
      }

      console.log('[SettingsEffectsManager] HTML attributes:', {
        glassEffects: html.getAttribute('data-glass-effects'),
        eosGradients: html.getAttribute('data-eos-gradients'),
      });
    } catch (error) {
      console.error('[SettingsEffectsManager] Error:', error);
      // Don't throw - just log the error and continue
    }
  }, [settings?.disableGlassEffects, settings?.disableEosGradient, loading]);

  return null; // This component doesn't render anything
}

