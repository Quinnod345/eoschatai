import ClientRedirect from '@/components/client-redirect';

export default async function DocumentPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Redirect to chat with document ID as a query parameter (client-side)
  // The chat interface can then load and display the document
  return <ClientRedirect path={`/chat?document=${id}`} />;
}
