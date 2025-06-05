'use client';

import dynamic from 'next/dynamic';

// Dynamic import of the animation component with SSR disabled
const ClientChatAnimation = dynamic(() => import('./ClientChatAnimation'), {
  ssr: false,
});

export default function ChatAnimationWrapper() {
  return <ClientChatAnimation />;
}
