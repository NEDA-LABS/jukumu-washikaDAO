/**
 * Row -> public API object mappers.
 *
 * Kept in one place so a column rename never silently changes the public
 * contract, and so internal-only columns (id_number, ntzs_user_id, phone of
 * other members, raw metadata) are never leaked by accident. Money is always
 * an integer number of TZS; timestamps are always ISO-8601 strings.
 */

const iso = (v: unknown): string | null =>
  v ? new Date(v as string).toISOString() : null;

const int = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

/**
 * Group logos are stored as inline base64 data URLs (tens of KB each), so
 * echoing them in a 100-row list would produce a multi-megabyte response.
 * Lists therefore report `has_logo` and omit the payload; the single-group
 * endpoint returns it in full.
 */
function logoFields(raw: unknown, compact: boolean) {
  const url = typeof raw === 'string' && raw.length > 0 ? raw : null;
  const isInline = !!url && url.startsWith('data:');
  if (compact && isInline) return { logo_url: null, has_logo: true };
  return { logo_url: url, has_logo: !!url };
}

export function serializeGroup(r: Record<string, unknown>, opts: { compact?: boolean } = {}) {
  return {
    id: r.id as number,
    name: r.name as string,
    code: (r.group_code as string) ?? null,
    status: (r.status as string) ?? 'active',
    ...logoFields(r.logo_url, opts.compact ?? false),
    founded_date: iso(r.founded_date),
    contribution: {
      amount_tzs: int(r.monthly_contribution),
      frequency: (r.contribution_frequency as string) ?? 'monthly',
    },
    voting_threshold: {
      numerator: int(r.voting_threshold_numerator) || 3,
      denominator: int(r.voting_threshold_denominator) || 5,
    },
    join_policy: (r.join_policy as string) ?? 'invite_only',
    member_count: r.member_count !== undefined ? int(r.member_count) : undefined,
    leader_name: (r.leader_name as string) ?? undefined,
    treasury_balance_tzs: r.treasury_balance_tzs !== undefined ? int(r.treasury_balance_tzs) : undefined,
    created_at: iso(r.created_at),
  };
}

export function serializeMember(r: Record<string, unknown>, opts: { compact?: boolean } = {}) {
  const avatar = typeof r.avatar_url === 'string' && r.avatar_url.length > 0 ? r.avatar_url : null;
  const inlineAvatar = !!avatar && avatar.startsWith('data:');
  return {
    id: r.id as number,
    full_name: (r.full_name as string) ?? null,
    username: (r.username as string) ?? null,
    // Same reasoning as group logos — see logoFields above.
    avatar_url: opts.compact && inlineAvatar ? null : avatar,
    has_avatar: !!avatar,
    location: (r.location as string) ?? null,
    status: (r.status as string) ?? null,
    business: {
      name: (r.business_name as string) ?? null,
      type: (r.business_type as string) ?? null,
    },
    // Membership context — only present when queried within a group.
    role: (r.role as string) ?? undefined,
    membership_status: (r.membership_status as string) ?? undefined,
    joined_date: r.joined_date !== undefined ? iso(r.joined_date) : undefined,
    created_at: iso(r.created_at),
  };
}

export function serializeTransaction(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    external_id: (r.ntzs_id as string) ?? null,
    type: r.type as string,
    purpose: (r.purpose as string) ?? null,
    status: r.status as string,
    amount_tzs: int(r.amount_tzs),
    fee_tzs: int(r.fee_tzs),
    net_tzs: int(r.net_tzs),
    from: {
      member_id: (r.from_member_id as number) ?? null,
      member_name: (r.from_member_name as string) ?? null,
      group_id: (r.from_group_id as number) ?? null,
      group_name: (r.from_group_name as string) ?? null,
    },
    to: {
      member_id: (r.to_member_id as number) ?? null,
      member_name: (r.to_member_name as string) ?? null,
      group_id: (r.to_group_id as number) ?? null,
      group_name: (r.to_group_name as string) ?? null,
    },
    note: (r.note as string) ?? null,
    created_at: iso(r.created_at),
  };
}

export function serializeContribution(r: Record<string, unknown>) {
  return {
    id: r.id as number,
    member_id: r.member_id as number,
    member_name: (r.member_name as string) ?? null,
    group_id: r.group_id as number,
    amount_tzs: int(r.amount),
    period: (r.contribution_month as string) ?? null,
    status: (r.status as string) ?? null,
    payment_method: (r.payment_method as string) ?? null,
    reference: (r.payment_reference as string) ?? null,
    paid_at: iso(r.payment_date),
    created_at: iso(r.created_at),
  };
}

export function serializeProposal(r: Record<string, unknown>) {
  const meta = (r.metadata as Record<string, unknown> | null) ?? null;
  return {
    id: r.id as number,
    group_id: r.group_id as number,
    title: r.title as string,
    description: (r.description as string) ?? null,
    type: (r.proposal_type as string) ?? 'general',
    status: r.status as string,
    created_by: {
      member_id: (r.created_by_member_id as number) ?? null,
      name: (r.created_by_name as string) ?? null,
    },
    payment: {
      amount_tzs: r.payment_amount_tzs != null ? int(r.payment_amount_tzs) : null,
      status: (r.payment_status as string) ?? null,
      recipient_member_id: (r.recipient_member_id as number) ?? null,
      executed_at: iso(r.executed_at),
    },
    votes: r.yes_votes !== undefined
      ? {
          yes: int(r.yes_votes),
          no: int(r.no_votes),
          abstain: int(r.abstain_votes),
          total: int(r.total_votes),
        }
      : undefined,
    // Only project-facing metadata is exposed; attachments stay internal
    // because they can be multi-MB data URLs.
    funding_goal_tzs: meta?.funding_goal_tzs != null ? int(meta.funding_goal_tzs) : null,
    timeline: (meta?.timeline as string) ?? null,
    expected_impact: (meta?.expected_impact as string) ?? null,
    funded_at: iso(r.funded_at),
    created_at: iso(r.created_at),
  };
}
