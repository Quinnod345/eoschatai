'use client';

import { Toaster } from 'sonner';
import { useTheme } from 'next-themes';
import { CheckCircle, X, AlertCircle, Info, Loader2 } from 'lucide-react';

export function EnhancedToastProvider() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme as 'light' | 'dark' | 'system'}
      position="top-right"
      expand={true}
      richColors={false}
      duration={4000}
      visibleToasts={3}
      closeButton={true}
      toastOptions={{
        style: {
          background: 'white',
          border: '1px solid #e5e7eb',
          color: '#374151',
          fontSize: '14px',
          borderRadius: '8px',
          padding: '12px 16px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          maxWidth: '400px',
          minHeight: '48px',
        },
        className: 'enhanced-toast',
        descriptionClassName: 'toast-description',
      }}
      icons={{
        success: <CheckCircle className="h-4 w-4 text-green-600" />,
        error: <X className="h-4 w-4 text-red-600" />,
        warning: <AlertCircle className="h-4 w-4 text-amber-600" />,
        info: <Info className="h-4 w-4 text-blue-600" />,
        loading: <Loader2 className="h-4 w-4 animate-spin text-gray-600" />,
      }}
    />
  );
}
