import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ChatNotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-background p-4">
      <div className="flex flex-col items-center gap-6 max-w-lg text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-xl font-semibold">Chat Not Found</h1>
          <p className="text-muted-foreground">
            We couldn&apos;t find the chat you&apos;re looking for. It may have
            been deleted or you may not have permission to view it.
          </p>
        </div>

        <div className="flex flex-row gap-4">
          <Button asChild>
            <Link href="/chat">Start a new chat</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
