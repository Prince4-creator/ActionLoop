import { JoinLinkClient } from './join-link-client';

export default async function JoinLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinLinkClient token={token} />;
}