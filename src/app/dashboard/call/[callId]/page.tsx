import CallRoom from './CallRoom';

export default async function CallPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  return <CallRoom callId={callId} />;
}
