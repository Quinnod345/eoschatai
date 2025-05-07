'use client';

import { useEffect, useState } from 'react';

export function DebugInfo({
  provider,
  model,
}: {
  provider: string;
  model: string;
}) {
  const [cookies, setCookies] = useState<Record<string, string>>({});
  
  useEffect(() => {
    // Parse cookies from document.cookie
    const parseCookies = () => {
      const cookiesObj: Record<string, string> = {};
      document.cookie.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookiesObj[name] = decodeURIComponent(value);
        }
      });
      setCookies(cookiesObj);
    };
    
    parseCookies();
    
    // Set up an interval to check cookies periodically
    const interval = setInterval(parseCookies, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-0 right-0 bg-black/80 text-white p-2 text-xs z-50 rounded-tl-md">
      <div>
        <strong>Provider Props:</strong> {provider}
      </div>
      <div>
        <strong>Model Props:</strong> {model}
      </div>
      <div>
        <strong>Provider Cookie:</strong> {cookies['ai-provider'] || 'not set'}
      </div>
      <div>
        <strong>Model Cookie:</strong> {cookies['chat-model'] || 'not set'}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        Debug Panel
      </div>
    </div>
  );
} 