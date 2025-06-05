import { redirect } from 'next/navigation';

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Redirect to chat with document ID as a query parameter
  // The chat interface can then load and display the document
  redirect(`/chat?document=${id}`);
}
