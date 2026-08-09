import { redirect } from 'next/navigation';

/**
 * Retired route.
 *
 * A group used to be its own page with its own sidebar and visual language.
 * Everything it did — roster, join requests, leadership, finances,
 * disbursement, proposals — now lives inside the member app shell, so this
 * only forwards.
 *
 * It is a redirect rather than a deletion because the id is baked into every
 * notification actionUrl already sent, and those links have to keep working.
 * The nested /proposals/[proposalId] route is unaffected.
 */
export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  redirect(
    Number.isFinite(groupId)
      ? `/member-dashboard?section=group&group=${groupId}`
      : '/member-dashboard?section=group'
  );
}
