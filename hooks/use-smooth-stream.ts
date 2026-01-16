import { useEffect, useState, useRef } from 'react';

/**
 * A hook that accepts a streaming string and returns a "smoothed" version
 * that updates character-by-character (typewriter effect).
 * 
 * @param content The full content string that is being streamed
 * @param isStreaming Whether the content is currently being streamed
 * @param streamSpeed Speed in ms per character (default 10ms)
 */
export function useSmoothStream(
  content: string,
  isStreaming: boolean,
  streamSpeed: number = 5
) {
  const [displayContent, setDisplayContent] = useState(
    isStreaming ? '' : content
  );
  
  // Refs to keep track of the latest values
  const contentRef = useRef(content);
  const displayContentRef = useRef(displayContent);
  const isStreamingRef = useRef(isStreaming);
  const requestRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Update refs whenever props change
  useEffect(() => {
    contentRef.current = content;
    isStreamingRef.current = isStreaming;
  }, [content, isStreaming]);

  // Handle initial load / non-streaming mode
  useEffect(() => {
    if (!isStreaming) {
      setDisplayContent(content);
      displayContentRef.current = content;
    }
  }, [isStreaming, content]);

  useEffect(() => {
    // If not streaming, do nothing (handled by the other effect)
    if (!isStreamingRef.current) return;

    const animate = (timestamp: number) => {
      // Safety check
      if (!isStreamingRef.current) return;

      const currentLen = displayContentRef.current.length;
      const targetLen = contentRef.current.length;

      if (currentLen < targetLen) {
        // We are behind, need to catch up
        if (timestamp - lastUpdateRef.current >= streamSpeed) {
          const delta = targetLen - currentLen;
          // Adaptive chunk size: speed up if we fall too far behind
          const chunkSize = delta > 50 ? 5 : delta > 20 ? 2 : 1;
          
          const nextContent = contentRef.current.slice(0, currentLen + chunkSize);
          
          setDisplayContent(nextContent);
          displayContentRef.current = nextContent;
          lastUpdateRef.current = timestamp;
        }
      } else if (currentLen > targetLen) {
        // We got ahead (truncation/reset), snap back
        const resetContent = contentRef.current;
        setDisplayContent(resetContent);
        displayContentRef.current = resetContent;
      }
      
      // Keep the loop alive to catch new tokens arriving
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isStreaming, streamSpeed]); // Still stable dependencies

  return displayContent;
}
