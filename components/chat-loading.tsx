'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export function ChatLoading() {
  useEffect(() => {
    document.body.classList.add('has-chat-mesh');
    return () => {
      document.body.classList.remove('has-chat-mesh');
    };
  }, []);
  return (
    <div className="eos-chat-mesh eos-chat-active existing-chat-gradient flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 relative bg-transparent">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative"
      >
        <div className="absolute inset-0 bg-eos-orange/20 rounded-full animate-ping" />
        <div className="relative bg-eos-orange/10 rounded-full p-6">
          <MessageSquare className="h-12 w-12 text-eos-orange" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="text-center space-y-2"
      >
        <h3 className="text-lg font-medium text-foreground">Loading Chat</h3>
        <p className="text-sm text-muted-foreground">
          Preparing your conversation...
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2"
      >
        <Loader2 className="h-4 w-4 animate-spin text-eos-orange" />
        <span className="text-sm text-muted-foreground">Please wait</span>
      </motion.div>

      {/* Progress indicator */}
      <motion.div
        initial={{ opacity: 0, width: 0 }}
        animate={{ opacity: 1, width: '200px' }}
        transition={{ delay: 0.3 }}
        className="h-1 bg-muted rounded-full overflow-hidden"
      >
        <motion.div
          className="h-full bg-gradient-to-r from-eos-orange to-eos-navy rounded-full"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{
            duration: 1.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
        />
      </motion.div>
    </div>
  );
}
