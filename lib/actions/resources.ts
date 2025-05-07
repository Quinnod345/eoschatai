import { generateUUID } from '@/lib/utils';
import { saveDocument } from '@/lib/db/queries';
import { auth } from '@/app/(auth)/auth';

export interface CreateResourceProps {
  content: string;
}

export async function createResource({ content }: CreateResourceProps) {
  const session = await auth();
  if (!session?.user) {
    throw new Error('Unauthorized');
  }
  const userId = session.user.id;
  const id = generateUUID();
  // Use the first 50 characters of content as the title
  const title = content.slice(0, 50) || 'Knowledge Base Entry';
  const [savedDocument] = await saveDocument({
    id,
    title,
    kind: 'text',
    content,
    userId,
  });
  return savedDocument;
}
