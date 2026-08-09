'use client';
/* build:20260224-1410 */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ToastProvider';
import {
  ChartBarIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  BookOpenIcon,
  UserIcon,
  WalletIcon,
  Bars3Icon,
  XMarkIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import WalletDashboard from '@/components/WalletDashboard';
import Logo from '@/components/Logo';
import { useTheme } from '@/contexts/ThemeContext';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import QuickActionModal, { type ActionType } from '@/components/QuickActionModal';
import NotificationsSection from '@/components/NotificationsSection';
import AvatarPicker from '@/components/AvatarPicker';
import NotificationBell from '@/components/NotificationBell';
import MemberAppShell, { type MemberTab } from '@/components/member/MemberAppShell';
import HomeScreen, { type HomeProposal } from '@/components/member/HomeScreen';
import MeScreen from '@/components/member/MeScreen';
import GroupScreen, { type GroupScreenData, type GroupMemberRow } from '@/components/member/GroupScreen';
import GroupList from '@/components/member/GroupList';
import GroupDetail, { type GroupSection } from '@/components/member/GroupDetail';
import CreateProposalModal from '@/components/member/CreateProposalModal';
import ClaimUsernameModal, { shouldPromptForUsername } from '@/components/member/ClaimUsernameModal';
import GovernanceScreen, { type ProposalRow } from '@/components/member/GovernanceScreen';
import ProposalScreen, { type ProposalDetail } from '@/components/member/ProposalScreen';
import ContributeScreen, { type PayMethod } from '@/components/member/ContributeScreen';

type ScreenData = GroupScreenData & {
  myMemberId: number;
  openProposals: ProposalRow[];
  closedProposals: ProposalRow[];
};
import { type WallData, type WallPeriod } from '@/components/UkutaWall';

type HomeData = {
  member: { id: number; firstName: string; since: string } | null;
  balanceTzs: number;
  streakMonths: number;
  paidThisMonth: boolean;
  dueTzs: number;
  group: { id: number; name: string; code: string | null; memberCount: number } | null;
  groups: { id: number; name: string; code: string | null; logoUrl: string | null;
            memberCount: number; treasuryTzs: number; monthlyContribution: number }[];
  collectedTzs: number;
  targetTzs: number;
  proposal: HomeProposal | null;
  activity: { id: string; type: string; purpose: string | null; amountTzs: number; groupName: string | null; at: string }[];
};

export default function MemberDashboard() {
  const { language, toggleLanguage, t } = useLanguage();
  const { showToast } = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<{id?: number; fullName?: string; email: string; role?: string} | null>(null);
  const [memberInfo, setMemberInfo] = useState<{id?: number; fullName?: string; email?: string} | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [memberProfile, setMemberProfile] = useState<any>(null);
  const [memberInvestments, setMemberInvestments] = useState<any[]>([]);
  const [memberTraining, setMemberTraining] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Home is one request; the wall is its own so a slow roster query never
  // holds up the balance, which is the first thing anyone looks at.
  const [home, setHome] = useState<HomeData | null>(null);
  const [wall, setWall] = useState<WallData | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  // Home's money buttons open the real action directly. Sending someone to a
  // wallet tab to hunt for the button they just pressed is the old dashboard's
  // habit, not the prototype's.
  const [quick, setQuick] = useState<{ type: ActionType; purpose?: 'contribution' | 'p2p' } | null>(null);

  // Kikundi and Utawala read the same payload — one roster query serving both
  // beats two endpoints returning overlapping halves of the group.
  const [screen, setScreen] = useState<ScreenData | null>(null);
  // Kikundi is a two-level view: null shows the list of groups, a set id opens
  // that group's detail. Opening a group makes it the active group (the app
  // speaks for one chama at a time, as the old switcher already did), so the
  // detail, Home and Utawala all agree on which group they mean.
  const [groupDetailId, setGroupDetailId] = useState<number | null>(null);
  // Which section of the open group is showing. Entering a group always starts
  // on Overview rather than resuming wherever you last were.
  const [groupSection, setGroupSection] = useState<GroupSection>('overview');
  const [newProposalFor, setNewProposalFor] = useState<{ id: number; name: string } | null>(null);
  const [showClaimUsername, setShowClaimUsername] = useState(false);
  // Opening a proposal pushes it over the governance list rather than routing
  // away — the tab bar has to stay put for this to read as an app.
  const [openProposal, setOpenProposal] = useState<ProposalDetail | null>(null);
  const [voting, setVoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const loadScreen = React.useCallback((gid: number) => {
    fetch(`/api/member/groups/${gid}/screen`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: ScreenData | null) => { if (d) setScreen(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (home?.group?.id) loadScreen(home.group.id);
  }, [home?.group?.id, loadScreen]);

  // Deep links land here: notification actionUrls and the retired
  // /member-dashboard/groups/[id] route both arrive as
  // ?section=group&group=<id>. Read straight off the URL rather than through
  // useSearchParams, which would force this prerendered page into a Suspense
  // boundary purely to look at one query string.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const gid = Number(q.get('group'));
    if (Number.isFinite(gid) && gid > 0) {
      setActiveSection('group');
      setActiveGroupId(gid);
      setGroupDetailId(gid);
      setGroupSection('overview');
      loadScreen(gid);
    } else if (q.get('section') === 'group') {
      setActiveSection('group');
    }
    // Once only, on mount — later navigation is driven by state, not the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProposalById = React.useCallback(async (gid: number, pid: number) => {
    try {
      const res = await fetch(`/api/member/groups/${gid}/proposals/${pid}`);
      if (!res.ok) { router.push(`/member-dashboard/groups/${gid}/proposals/${pid}`); return; }
      const d = await res.json();
      const p = d.proposal ?? d;
      // The route returns tallies under `voteSummary`; reading `votes` would
      // have silently rendered every proposal as 0–0.
      const yes = Number(d.voteSummary?.yes ?? 0);
      const no = Number(d.voteSummary?.no ?? 0);
      setOpenProposal({
        id: pid,
        groupId: gid,
        title: p.title ?? '',
        body: p.description ?? null,
        kind: p.proposal_type || 'proposal',
        amountTzs: Number(p.payment_amount_tzs ?? 0),
        by: p.created_by_name ?? p.creator_name ?? null,
        yes, no,
        pending: Math.max(0, (screen?.total ?? 0) - (yes + no)),
        myVote: d.myVote ?? p.my_vote ?? null,
        requiredYes: Number(d.requiredYes ?? 0),
        status: p.status ?? 'open',
        isLeader: screen?.isLeader ?? false,
      });
    } catch {
      router.push(`/member-dashboard/groups/${gid}/proposals/${pid}`);
    }
  }, [router, screen?.total, screen?.isLeader]);

  const castVote = React.useCallback(async (v: 'yes' | 'no') => {
    if (!openProposal) return;
    setVoting(true);
    try {
      const res = await fetch(
        `/api/member/groups/${openProposal.groupId}/proposals/${openProposal.id}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote: v }) },
      );
      if (res.ok) {
        await openProposalById(openProposal.groupId, openProposal.id);
        loadScreen(openProposal.groupId);
      }
    } finally {
      setVoting(false);
    }
  }, [openProposal, openProposalById, loadScreen]);

  const submitContribution = React.useCallback(async ({ amountTzs, method, phone }: {
    amountTzs: number; method: PayMethod; phone: string;
  }) => {
    if (!user?.id || !home?.group) return;
    setPaying(true); setPayError(null);
    try {
      // From the wallet this is an internal ledger transfer; by mobile money it
      // is a deposit that has to land before it can become a contribution.
      const res = method === 'wallet'
        ? await fetch('/api/wallet/transfer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, purpose: 'contribution', amountTzs, groupId: home.group.id }),
          })
        : await fetch('/api/wallet/deposit', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, amountTzs, phoneNumber: `255${phone}` }),
          });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setPayError(d.error || 'Could not complete that.'); return; }
      reloadHome();
      if (home.group) loadScreen(home.group.id);
      setActiveSection('overview');
    } catch {
      setPayError('Network error. Try again.');
    } finally {
      setPaying(false);
    }
  }, [user?.id, home?.group, loadScreen]);

  const inviteToGroup = React.useCallback(async () => {
    if (!screen?.group.code) return;
    const url = `${window.location.origin}/register?group=${encodeURIComponent(screen.group.code)}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('grp.inviteSent'), 'success');
    } catch {
      // Clipboard is blocked in some in-app browsers; the group page has the
      // full share sheet, so fall back there rather than failing silently.
      router.push(`/member-dashboard/groups/${screen.group.id}`);
    }
  }, [screen?.group.code, screen?.group.id, router, t]);

  const remindUnpaid = React.useCallback(async () => {
    if (!screen?.group.id) return;
    try {
      const res = await fetch(`/api/member/groups/${screen.group.id}/remind`, { method: 'POST' });
      if (res.ok) showToast(t('grp.reminded'), 'success');
      else router.push(`/member-dashboard/groups/${screen.group.id}`);
    } catch {
      router.push(`/member-dashboard/groups/${screen.group.id}`);
    }
  }, [screen?.group.id, router, t]);

  const reloadHome = React.useCallback(() => {
    fetch('/api/member/home')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: HomeData | null) => { if (d) setHome(d); })
      .catch(() => {});
  }, []);

  // Which group every screen speaks for. Null until the first load picks one.
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  // Week / month / year zoom on the Ukuta. Lives here because changing it
  // refetches the wall, which Home only renders.
  const [wallPeriod, setWallPeriod] = useState<WallPeriod>('month');

  useEffect(() => {
    let alive = true;
    // Drop the old group's wall first — showing one group's bricks under
    // another group's name is worse than showing a skeleton.
    setWall(null);
    fetch(activeGroupId ? `/api/member/home?groupId=${activeGroupId}` : '/api/member/home')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: HomeData) => {
        if (!alive) return;
        setHome(d);
        if (d.group) {
          fetch(`/api/member/groups/${d.group.id}/wall?period=${wallPeriod}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((w) => { if (alive && w) setWall(w); })
            .catch(() => {});
        }
      })
      .catch(() => { if (alive) setHome(null); });

    return () => { alive = false; };
  }, [activeGroupId, wallPeriod]);

  useEffect(() => {
    let alive = true;
    fetch('/api/notifications?unreadOnly=true&limit=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setUnreadCount(Number(d.unreadCount ?? d.total ?? 0)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Check authentication and load member data
  useEffect(() => {
    setMounted(true);
    const userData = localStorage.getItem('user');
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      
      // Redirect admins to admin dashboard
      if (parsedUser.role === 'admin') {
        router.push('/dashboard');
        return;
      }
      
      // Check URL parameters for section navigation
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get('section');
      if (section) {
        setActiveSection(section);
      }
      
      // First verify user-to-member mapping
      verifyUserMemberMapping(parsedUser.id);
    } else {
      router.push('/login');
    }
  }, [router]);

  const verifyUserMemberMapping = async (userId: number) => {
    try {
      const response = await fetch(`/api/user-to-member?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok && data.success) {
        console.log('User-Member mapping:', data);
        
        if (data.hasMemberProfile) {
          // Store the correct member information
          setMemberInfo({
            id: data.member.id,
            fullName: data.member.full_name,
            email: data.member.email
          });
          // Load member data using the correct member ID
          loadMemberData(userId, data.member.id);
        } else {
          console.warn('User has no member profile');
          setLoading(false);
        }
      } else {
        console.error('Failed to verify user-member mapping:', data.error);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error verifying user-member mapping:', error);
      setLoading(false);
    }
  };

  const loadMemberData = async (userId: number, memberId?: number) => {
    setLoading(true);
    try {
      // Fire everything the overview needs in parallel — sequential awaits were
      // adding a round-trip per endpoint. The heavy educational-content call is
      // deferred to the Learning tab (see loadTrainingIfNeeded).
      const [profileRes, investmentsRes] = await Promise.all([
        fetch(`/api/members/profile?userId=${userId}`).catch(() => null),
        fetch(`/api/members/investments?userId=${userId}`).catch(() => null),
      ]);
      if (profileRes?.ok) {
        const profile = await profileRes.json();
        setMemberProfile(profile);
        // Members who registered before usernames existed get one chance to
        // claim theirs. shouldPromptForUsername owns the "only once" rule.
        if (shouldPromptForUsername(profile?.username)) setShowClaimUsername(true);
      }
      if (investmentsRes?.ok) setMemberInvestments(await investmentsRes.json());
    } catch (error) {
      console.error('Error loading member data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrainingIfNeeded = React.useCallback(async () => {
    if (memberTraining.length > 0) return;
    try {
      const res = await fetch(`/api/educational-content`);
      if (!res.ok) return;
      const trainingData = await res.json();
      setMemberTraining(trainingData.map((content: any) => ({
        id: content.id,
        title: content.title,
        description: content.description,
        duration_hours: parseFloat(content.duration?.replace(/[^0-9.]/g, '') || '1'),
        category: content.category,
        level: content.difficulty_level,
        progress_status: 'not_started',
        progress_percentage: 0,
        started_at: null,
        completed_at: null,
      })));
    } catch {}
  }, [memberTraining.length]);

  useEffect(() => {
    if (activeSection === 'learning') loadTrainingIfNeeded();
  }, [activeSection, loadTrainingIfNeeded]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/');
  };

  if (!mounted || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const menuItems = [
    { id: 'overview', name: t('dash.nav.overview'), icon: ChartBarIcon },
    { id: 'wallet', name: t('dash.nav.wallet'), icon: WalletIcon },
    { id: 'group', name: t('dash.nav.group'), icon: UserGroupIcon },
    { id: 'investments', name: t('dash.nav.investments'), icon: CurrencyDollarIcon },
    { id: 'learning', name: t('dash.nav.training'), icon: AcademicCapIcon },
    { id: 'notifications', name: t('notif.title'), icon: BellIcon },
    { id: 'settings', name: t('dash.nav.settings'), icon: CogIcon },
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} onNavigate={setActiveSection} userId={user?.id || 0} />;
      case 'wallet':
        return <WalletDashboard userId={user?.id || 0} username={memberProfile?.username} />;
      case 'profile':
        return <ProfileSection memberProfile={memberProfile} user={user} loadMemberData={() => loadMemberData(user?.id || 0)} />;
      case 'group':
        return <MyGroupSection memberProfile={memberProfile} />;
      case 'investments':
        return <MyInvestmentsSection memberInvestments={memberInvestments} />;
      case 'learning':
        return <LearningSection memberTraining={memberTraining} user={user} />;
      case 'notifications':
        return <NotificationsSection userId={user?.id || 0} />;
      case 'settings':
        return <MemberSettingsSection onNavigate={setActiveSection} user={user} memberProfile={memberProfile} loadMemberData={() => loadMemberData(user?.id || 0)} />;
      default:
        return <MemberOverviewSection memberProfile={memberProfile} memberInvestments={memberInvestments} onNavigate={setActiveSection} userId={user?.id || 0} />;
    }
  };

  const activeName = menuItems.find(m => m.id === activeSection)?.name || 'Overview';

  const initials = (user.fullName || user.email || 'U')[0].toUpperCase();

  // ── The prototype's five tabs ──────────────────────────────────────────
  // The old sidebar exposed seven peer sections. The prototype collapses that
  // to five thumb-reachable tabs, with the sections that are not daily acts
  // (investments, training, settings) moved behind "Mimi". Nothing is dropped;
  // the hierarchy just stops pretending every section is equally urgent.
  const TAB_SECTION: Record<MemberTab, string> = {
    home: 'overview',
    group: 'group',
    contribute: 'contribute',
    // Its own section id, not 'group' — sharing one would make the two tabs
    // indistinguishable and light both at once.
    governance: 'governance',
    me: 'me',
  };

  const tab: MemberTab =
    activeSection === 'overview' ? 'home'
    : activeSection === 'group' ? 'group'
    : activeSection === 'governance' ? 'governance'
    : activeSection === 'contribute' ? 'contribute'
    : 'me';

  // Leaving a tab drops the proposal detail, so returning to Utawala lands on
  // the list rather than the last thing that happened to be open.
  const onTab = (next: MemberTab) => {
    if (next !== 'governance') setOpenProposal(null);
    if (next === 'contribute') setPayError(null);
    // Kikundi always opens on the list — tapping the tab is a "show me my
    // groups" gesture, not "resume the last group I was inside".
    if (next === 'group') setGroupDetailId(null);
    setActiveSection(TAB_SECTION[next]);
  };

  const headerTitle =
    tab === 'home' ? (home?.group?.name ?? 'WashikaDAU')
    : menuItems.find((m) => m.id === activeSection)?.name ?? 'WashikaDAU';

  const headerKicker =
    tab === 'home' && home?.group
      ? `${home.group.code ?? ''}${home.group.code ? ' · ' : ''}${home.group.memberCount} ${language === 'sw' ? 'WANACHAMA' : 'MEMBERS'}`
      : (user.fullName || user.email || '').toUpperCase();

  return (
    <MemberAppShell
      kicker={headerKicker}
      title={headerTitle}
      tab={tab}
      onTab={onTab}
      unread={unreadCount}
      onBell={() => setActiveSection('notifications')}
      avatarUrl={memberProfile?.avatar_url ?? null}
      initials={initials}
      onAvatar={() => setActiveSection('settings')}
    >
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent wd-round" />
        </div>
      ) : tab === 'home' && home ? (
        <HomeScreen
          firstName={home.member?.firstName || (user.fullName || 'U').split(' ')[0]}
          balanceTzs={home.balanceTzs}
          streakMonths={home.streakMonths}
          paidThisMonth={home.paidThisMonth}
          dueTzs={home.dueTzs}
          sinceLabel={home.member?.since ? new Date(home.member.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : null}
          group={home.group ? { id: home.group.id, name: home.group.name, code: home.group.code } : null}
          wall={wall}
          wallPeriod={wallPeriod}
          onWallPeriod={setWallPeriod}
          collectedTzs={home.collectedTzs}
          targetTzs={home.targetTzs}
          proposal={home.proposal}
          activity={home.activity.map((a) => ({
            id: a.id,
            glyph: a.type === 'deposit' ? '↓' : a.type === 'withdrawal' ? '↑' : a.purpose === 'contribution' ? '◧' : '⇄',
            text: `${a.purpose === 'contribution' ? t('home.contribute') : a.type === 'deposit' ? t('wal.deposit') : a.type === 'withdrawal' ? t('wal.withdraw') : t('wal.transfer')}${a.groupName ? ` · ${a.groupName}` : ''} — TSh ${Math.round(a.amountTzs).toLocaleString('en-US')}`,
            time: new Date(a.at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          }))}
          onContribute={() => setQuick({ type: 'transfer', purpose: 'contribution' })}
          onDeposit={() => setQuick({ type: 'deposit' })}
          onTransfer={() => setQuick({ type: 'transfer', purpose: 'p2p' })}
          onWithdraw={() => setQuick({ type: 'withdraw' })}
          onWallet={() => setActiveSection('wallet')}
          onWhoPaid={() => home.group && router.push(`/member-dashboard/groups/${home.group.id}`)}
          onGovernance={() => home.group && router.push(`/member-dashboard/groups/${home.group.id}`)}
          onProposal={(pr) => router.push(`/member-dashboard/groups/${pr.groupId}/proposals/${pr.id}`)}
          onActivity={() => setActiveSection('wallet')}
        />
      ) : tab === 'contribute' && home ? (
        <ContributeScreen
          monthlyContribution={screen?.group.monthlyContribution ?? 0}
          walletBalanceTzs={home.balanceTzs}
          groupName={home.group?.name ?? null}
          submitting={paying}
          error={payError}
          onSubmit={submitContribution}
        />
      ) : (tab === 'governance' || tab === 'group') && openProposal ? (
        <ProposalScreen
          p={openProposal}
          submitting={voting}
          onVote={castVote}
          // Closing returns to wherever it was opened from rather than routing
          // away, so the tab bar and the group you were in both stay put.
          onClose={() => setOpenProposal(null)}
        />
      ) : tab === 'group' && groupDetailId === null ? (
        <GroupList
          groups={home?.groups ?? []}
          onOpen={(id) => {
            setOpenProposal(null);
            setActiveGroupId(id);
            setGroupDetailId(id);
            setGroupSection('overview');
            // Drop a screen belonging to a different group so its data can't
            // flash, but keep one that already matches.
            setScreen((prev) => (prev && prev.group.id === id ? prev : null));
            // Load explicitly. The effect below only reacts to home.group.id
            // changing, so opening the group that is already the default would
            // otherwise clear the screen and never refetch it — an endless
            // spinner on exactly one of your groups.
            loadScreen(id);
          }}
        />
      ) : tab === 'group' && screen ? (
        <div className="animate-[wdIn_.22s_ease_both]">
          {/* Back to the group list. The tab bar stays put, so this is the
              only way up a level, and it must be obvious. */}
          <button
            onClick={() => setGroupDetailId(null)}
            className="wd-press flex items-center gap-1.5 border-b border-border px-5 py-2.5 text-[11px] font-semibold text-muted-foreground"
          >
            <span className="font-mono">←</span> {t('grp.myGroups')}
          </button>
          <GroupDetail
            data={screen}
            groups={home?.groups ?? []}
            section={groupSection}
            onSection={setGroupSection}
            onSelectGroup={(id) => {
              setActiveGroupId(id);
              setGroupDetailId(id);
              setGroupSection('overview');
              setScreen((prev) => (prev && prev.group.id === id ? prev : null));
              loadScreen(id);
            }}
            onInvite={inviteToGroup}
            onRemind={remindUnpaid}
            onMember={() => {}}
            onProposal={(pid) => openProposalById(screen.group.id, pid)}
            onNewProposal={() => setNewProposalFor({ id: screen.group.id, name: screen.group.name })}
          />
        </div>
      ) : tab === 'group' && groupDetailId !== null ? (
        // Detail requested but its screen is still loading.
        <div className="flex h-40 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent wd-round" />
        </div>
      ) : tab === 'governance' && screen ? (
        <GovernanceScreen
          open={screen.openProposals}
          closed={screen.closedProposals}
          canPropose
          onNewProposal={() => setNewProposalFor({ id: screen.group.id, name: screen.group.name })}
          onProposal={(p) => openProposalById(screen.group.id, p.id)}
        />
      ) : (tab === 'group' || tab === 'governance') && !home?.group ? (
        <div className="px-5 py-10 text-center">
          <p className="text-xs text-muted-foreground">{t('home.noGroup')}</p>
          <button
            onClick={() => setActiveSection('group')}
            className="wd-press mt-4 border-2 border-foreground px-4 py-3 text-[11px] font-semibold"
          >
            {t('home.joinGroup')}
          </button>
        </div>
      ) : tab === 'me' && activeSection === 'me' ? (
        <MeScreen
          name={user.fullName || user.email}
          username={memberProfile?.username}
          avatarUrl={memberProfile?.avatar_url}
          balanceTzs={home?.balanceTzs ?? 0}
          groupCount={home?.group ? 1 : 0}
          links={[
            { id: 'wallet', label: t('dash.nav.wallet') },
            { id: 'investments', label: t('dash.nav.investments') },
            { id: 'learning', label: t('dash.nav.training') },
            { id: 'notifications', label: t('notif.title'), meta: unreadCount ? String(unreadCount) : undefined },
            { id: 'profile', label: t('dash.nav.profile') },
            // Settings is where the username lives. This row used to point at
            // 'profile', so the username editor was unreachable.
            { id: 'settings', label: t('dash.nav.settings') },
          ]}
          onLink={setActiveSection}
          onLogout={handleLogout}
        />
      ) : (
        <div className="px-4 py-5 pb-8">{renderContent()}</div>
      )}

      {newProposalFor && (
        <CreateProposalModal
          groupId={newProposalFor.id}
          groupName={newProposalFor.name}
          onClose={() => setNewProposalFor(null)}
          onCreated={() => {
            const gid = newProposalFor.id;
            setNewProposalFor(null);
            // Land on Decisions with the new proposal already in the list.
            setGroupSection('decisions');
            loadScreen(gid);
          }}
        />
      )}

      {showClaimUsername && (
        <ClaimUsernameModal
          onClose={() => setShowClaimUsername(false)}
          onClaimed={(u) => {
            setMemberProfile((prev: any) => (prev ? { ...prev, username: u } : prev));
            setShowClaimUsername(false);
            showToast(t('user.claim.available'), 'success');
          }}
        />
      )}

      {quick && user?.id && (
        <QuickActionModal
          userId={user.id}
          type={quick.type}
          initialPurpose={quick.purpose}
          onClose={() => setQuick(null)}
          onSuccess={reloadHome}
        />
      )}
    </MemberAppShell>
  );
}

type FeedItem = {
  key: string;
  kind: 'join' | 'deposit' | 'withdraw' | 'contribution' | 'received' | 'transfer' | 'proposal';
  date: string;
  title_sw: string;
  title_en: string;
  subtitle: string | null;
  href: string;
};

function MemberOverviewSection({ memberProfile, memberInvestments, onNavigate, userId }: { memberProfile: any; memberInvestments: any[]; onNavigate: (section: string) => void; userId: number }) {
  const { t, language } = useLanguage();
  const router = useRouter();

  const [balanceTzs, setBalanceTzs] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [modal, setModal] = useState<ActionType | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [myGroups, setMyGroups] = useState<Array<{ id: number; name: string; logo_url?: string | null }>>([]);

  const fetchBalance = React.useCallback(() => {
    if (!userId) return;
    fetch(`/api/wallet/balance?userId=${userId}`)
      .then(r => r.json())
      .then(d => setBalanceTzs(d.balanceTzs ?? 0))
      .catch(() => setBalanceTzs(0))
      .finally(() => setBalanceLoading(false));
  }, [userId]);

  const fetchFeed = React.useCallback(() => {
    if (!userId) return;
    fetch(`/api/members/feed?userId=${userId}&limit=8`)
      .then(r => r.json())
      .then(d => setFeed(Array.isArray(d.items) ? d.items : []))
      .catch(() => setFeed([]));
  }, [userId]);

  useEffect(() => { fetchBalance(); fetchFeed(); }, [fetchBalance, fetchFeed]);

  useEffect(() => {
    fetch('/api/member/groups')
      .then(r => r.ok ? r.json() : { groups: [] })
      .then(d => setMyGroups((d.groups || []).map((g: any) => ({ id: g.id, name: g.name, logo_url: g.logo_url ?? null }))))
      .catch(() => setMyGroups([]));
  }, []);

  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const expectedReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.expected_return || 0), 0);
  const isActive = memberProfile?.status === 'active';

  const stats = [
    { name: t('dash.stat.membership'), value: isActive ? t('dash.stat.active') : t('dash.stat.pending'), icon: UserIcon, from: isActive ? 'from-emerald-400' : 'from-yellow-400', to: isActive ? 'to-teal-500' : 'to-amber-500' },
    { name: t('dash.stat.investment'), value: `TSh ${totalInvestment.toLocaleString()}`, icon: CurrencyDollarIcon, from: 'from-gold', to: 'to-primary' },
    { name: t('dash.stat.returns'), value: `TSh ${expectedReturns.toLocaleString()}`, icon: ChartBarIcon, from: 'from-fuchsia-400', to: 'to-purple-600' },
  ];

  const kindIcon: Record<FeedItem['kind'], string> = {
    join: '◉', deposit: '↓', withdraw: '↑', contribution: '⇢', received: '↙', transfer: '⇄', proposal: '✎',
  };
  const kindColor: Record<FeedItem['kind'], string> = {
    join: 'bg-blue-500/15 text-blue-500',
    deposit: 'bg-emerald-500/15 text-emerald-500',
    withdraw: 'bg-amber-500/15 text-amber-500',
    contribution: 'bg-primary/15 text-primary',
    received: 'bg-emerald-500/15 text-emerald-500',
    transfer: 'bg-sky-500/15 text-sky-500',
    proposal: 'bg-violet-500/15 text-violet-500',
  };
  const displayFeed = feed.length > 0
    ? feed.map(f => ({ ...f, label: language === 'en' ? f.title_en : f.title_sw }))
    : [{
        key: 'first',
        kind: 'join' as const,
        date: memberProfile?.created_at ?? '',
        title_sw: t('dash.joined'), title_en: t('dash.joined'),
        subtitle: null, href: '',
        label: t('dash.joined'),
      }];

  const actions: { label: string; icon: string; action: ActionType }[] = [
    { label: t('dash.action.deposit'), icon: 'M12 4v16m8-8H4', action: 'deposit' },
    { label: t('dash.action.withdraw'), icon: 'M20 12H4m8 8l-8-8 8-8', action: 'withdraw' },
    { label: t('dash.action.transfer'), icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4', action: 'transfer' },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {modal && (
        <QuickActionModal userId={userId} type={modal} onClose={() => setModal(null)} onSuccess={fetchBalance} />
      )}
      {/* Greeting */}
      <div>
        <h2 className="font-display text-3xl text-foreground">
          {t('dash.greeting')}, {memberProfile?.full_name?.split(' ')[0] || t('dash.member')} 👋
        </h2>
        <p className="text-sm text-muted-foreground mt-1">{t('dash.overview.subtitle')}</p>
      </div>

      {/* ── Balance hero card ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 bg-gradient-to-br from-primary via-gold-deep to-gold-deep shadow-2xl shadow-primary/30">
        {/* decorative hexagon watermark */}
        <div aria-hidden className="absolute -right-8 -top-10 opacity-[0.12]">
          <Logo markOnly className="h-52 w-52" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-white/70">{t('dash.balance.label')}</p>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-[10px] font-semibold text-white">TZS</span>
            </div>
          </div>

          {balanceLoading ? (
            <div className="h-11 w-52 rounded-lg bg-white/20 animate-pulse mt-3" />
          ) : (
            <p className="mt-2 font-display text-4xl sm:text-5xl font-semibold text-white tracking-tight">
              <span className="text-2xl sm:text-3xl align-top text-white/70 mr-1">TSh</span>
              {(balanceTzs ?? 0).toLocaleString()}
            </p>
          )}

          {/* Quick actions — open modal directly (no redirect) */}
          <div className="mt-6 grid grid-cols-3 gap-2.5">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => setModal(a.action)}
                className="group flex flex-col items-center gap-2 rounded-2xl bg-white/12 hover:bg-white/20 backdrop-blur-sm border border-white/15 py-3 transition-all hover:-translate-y-0.5"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-gold-deep group-hover:scale-110 transition-transform">
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.4}><path strokeLinecap="round" strokeLinejoin="round" d={a.icon} /></svg>
                </span>
                <span className="text-xs font-semibold text-white">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="group rounded-2xl bg-card hover:bg-muted border border-border p-4 flex flex-col gap-3 transition-all hover:-translate-y-1 hover:border-primary/30 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.from} ${s.to} flex items-center justify-center shadow-lg`}>
              <s.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground mb-0.5">{s.name}</p>
              <p className="text-sm font-bold text-foreground leading-tight">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* My Groups — clickable list */}
      <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-sky-400 to-blue-600" />
            {t('dash.stat.mygroup')}
          </h3>
          {myGroups.length > 0 && (
            <button
              onClick={() => onNavigate('group')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {t('inv.viewAll')} →
            </button>
          )}
        </div>
        {myGroups.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('dash.stat.nogroup')}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {myGroups.map(g => (
              <button
                key={g.id}
                onClick={() => router.push(`/member-dashboard/groups/${g.id}`)}
                className="flex items-center gap-3 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-muted transition-all px-3 py-2.5 text-left group"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white font-bold text-sm overflow-hidden">
                  {g.logo_url ? (
                    <img src={g.logo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    g.name.charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                </div>
                <span className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all">→</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Governance teaser */}
      <button
        onClick={() => onNavigate('group')}
        className="w-full text-left relative overflow-hidden rounded-2xl p-5 bg-gradient-to-r from-primary/10 to-gold/10 border border-primary/20 hover:border-primary/40 transition-all group"
      >
        <div aria-hidden className="absolute -right-6 -bottom-8 h-32 w-32 rounded-full bg-gold/15 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-gold to-primary shadow-lg">
            <DocumentTextIcon className="h-6 w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">{t('dash.governance.title')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('dash.governance.sub')}</p>
          </div>
          <span className="text-primary group-hover:translate-x-1 transition-transform text-lg">→</span>
        </div>
      </button>

      {/* Activity + nav shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity — clickable feed */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-gold to-primary" />
            {t('dash.activity.title')}
          </h3>
          <div className="space-y-1.5">
            {displayFeed.slice(0, 6).map((f) => {
              const clickable = !!f.href;
              const content = (
                <>
                  <span className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${kindColor[f.kind]} font-bold text-sm`}>
                    {kindIcon[f.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground/90 leading-snug truncate">{f.label}</p>
                    {f.date && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(f.date).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB')}</p>
                    )}
                  </div>
                  {clickable && <span className="text-muted-foreground group-hover:text-primary transition-colors">→</span>}
                </>
              );
              return clickable ? (
                <button
                  key={f.key}
                  onClick={() => router.push(f.href)}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-colors text-left group"
                >
                  {content}
                </button>
              ) : (
                <div key={f.key} className="w-full flex items-center gap-3 px-2 py-2">
                  {content}
                </div>
              );
            })}
          </div>
        </div>

        {/* Nav shortcuts */}
        <div className="rounded-2xl bg-card border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-to-b from-gold to-primary" />
            {t('dash.quicknav.title')}
          </h3>
          <div className="space-y-1.5">
            {[
              { label: t('dash.quicknav.wallet'), sub: t('dash.quicknav.wallet.sub'), icon: WalletIcon, section: 'wallet' },
              { label: t('dash.quicknav.group'), sub: t('dash.quicknav.group.sub'), icon: UserGroupIcon, section: 'group' },
              { label: t('dash.quicknav.training'), sub: t('dash.quicknav.training.sub'), icon: AcademicCapIcon, section: 'learning' },
              { label: t('dash.quicknav.investment'), sub: t('dash.quicknav.investment.sub'), icon: CurrencyDollarIcon, section: 'investments' },
            ].map((item) => (
              <button
                key={item.section}
                onClick={() => onNavigate(item.section)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors text-left group"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/15 transition-colors shrink-0">
                  <item.icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground/90 group-hover:text-foreground transition-colors">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <span className="ml-auto text-muted-foreground group-hover:text-primary transition-colors">→</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = (editing: boolean) =>
  `w-full px-3 py-2.5 rounded-lg text-sm border transition-colors focus:outline-none ${
    editing
      ? 'bg-white/5 border-border text-foreground placeholder:text-muted-foreground focus:border-gold/60'
      : 'bg-card border-border text-muted-foreground cursor-default'
  }`;

function ProfileSection({ memberProfile, user, loadMemberData }: { memberProfile: any; user: any; loadMemberData: () => void }) {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(memberProfile?.avatar_url ?? null);
  const [formData, setFormData] = useState({
    fullName: memberProfile?.full_name || '',
    phone: memberProfile?.phone || '',
    location: memberProfile?.location || '',
    businessType: memberProfile?.business_type || '',
    businessName: memberProfile?.business_name || '',
    businessDescription: memberProfile?.business_description || '',
    monthlyRevenue: memberProfile?.monthly_revenue || '',
    employeeCount: memberProfile?.employee_count || '',
  });

  useEffect(() => {
    if (memberProfile) {
      setFormData({
        fullName: memberProfile.full_name || '',
        phone: memberProfile.phone || '',
        location: memberProfile.location || '',
        businessType: memberProfile.business_type || '',
        businessName: memberProfile.business_name || '',
        businessDescription: memberProfile.business_description || '',
        monthlyRevenue: memberProfile.monthly_revenue || '',
        employeeCount: memberProfile.employee_count || '',
      });
      setAvatar(memberProfile.avatar_url ?? null);
    }
  }, [memberProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/members/profile?userId=${user?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, avatarUrl: avatar }),
      });
      if (res.ok) { setIsEditing(false); loadMemberData(); }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const initials = (formData.fullName || user?.email || 'U')
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  const Field = ({ label, type = 'text', value, field, disabled = false }: { label: string; type?: string; value: string; field?: keyof typeof formData; disabled?: boolean }) => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={field ? (e) => setFormData({ ...formData, [field]: e.target.value }) : undefined}
        disabled={!isEditing || disabled}
        className={inputCls(isEditing && !disabled)}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Profile header card */}
      <div className="rounded-xl bg-card border border-border p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-gold flex items-center justify-center shrink-0 overflow-hidden">
          {avatar ? (
            <img src={avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{formData.fullName || t('prof.member')}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{memberProfile?.email || user?.email}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs ${
            memberProfile?.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
          }`}>
            {memberProfile?.status === 'active' ? t('prof.activeMember') : t('prof.pending')}
          </span>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={saving}
          className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            isEditing
              ? 'bg-primary hover:bg-gold-deep text-foreground'
              : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
          }`}
        >
          {saving ? t('prof.saving') : isEditing ? t('prof.save') : t('prof.edit')}
        </button>
      </div>

      {/* Personal info */}
      <div className="rounded-xl bg-card border border-border p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prof.personalInfo')}</h3>
        {isEditing && (
          <div className="mb-4">
            <label className="block text-xs text-muted-foreground mb-2">{t('set.field.avatar')}</label>
            <AvatarPicker
              value={avatar}
              onChange={setAvatar}
              fallbackText={formData.fullName || 'U'}
              shape="circle"
              size={72}
              label={t('mg.field.logoUpload')}
              helper={t('set.field.avatarHelper')}
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('prof.fullName')} value={formData.fullName} field="fullName" />
          <Field label={t('prof.email')} value={memberProfile?.email || user?.email || ''} disabled />
          <Field label={t('prof.phone')} type="tel" value={formData.phone} field="phone" />
          <Field label={t('prof.location')} value={formData.location} field="location" />
        </div>
      </div>

      {/* Business info */}
      <div className="rounded-xl bg-card border border-border p-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t('prof.businessInfo')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label={t('prof.businessName')} value={formData.businessName} field="businessName" />
          <Field label={t('prof.businessType')} value={formData.businessType} field="businessType" />
          <Field label={t('prof.monthlyRevenue')} type="number" value={formData.monthlyRevenue} field="monthlyRevenue" />
          <Field label={t('prof.employeeCount')} type="number" value={formData.employeeCount} field="employeeCount" />
        </div>
        <div className="mt-3">
          <label className="block text-xs text-muted-foreground mb-1">{t('prof.businessDesc')}</label>
          <textarea
            value={formData.businessDescription}
            onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
            disabled={!isEditing}
            rows={3}
            className={`${inputCls(isEditing)} resize-none`}
          />
        </div>
      </div>

      {isEditing && (
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
          >
            {t('prof.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-gold-deep text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? t('prof.saving') : t('prof.saveChanges')}
          </button>
        </div>
      )}
    </div>
  );
}

function MyGroupSection({ memberProfile }: { memberProfile: any }) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5', contributionFrequency: 'monthly' as 'monthly' | 'weekly' });
  const [createLogo, setCreateLogo] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join by code state
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLookupResult, setJoinLookupResult] = useState<any>(null);
  const [joinLookupError, setJoinLookupError] = useState('');
  const [joinLookupLoading, setJoinLookupLoading] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      loadMyGroups();
      loadJoinRequests();
    }
  }, [memberProfile]);

  const loadMyGroups = async () => {
    try {
      const res = await fetch('/api/member/groups');
      if (res.ok) { const d = await res.json(); setMyGroups(d.groups || []); }
      else if (res.status === 401) router.push('/login');
    } catch (e) { console.error(e); }
  };

  const loadJoinRequests = async () => {
    try {
      const res = await fetch('/api/member/join-requests');
      if (res.ok) { const d = await res.json(); setJoinRequests(d.requests || []); }
      else if (res.status === 401) router.push('/login');
    } catch (e) { console.error(e); }
  };

  const handleLookupCode = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoinLookupLoading(true);
    setJoinLookupError('');
    setJoinLookupResult(null);
    setJoinFeedback(null);
    try {
      const res = await fetch(`/api/groups/lookup?code=${encodeURIComponent(code)}`);
      const d = await res.json();
      if (res.ok) { setJoinLookupResult(d.group); }
      else { setJoinLookupError(d.error || t('mg.joinModal.notFound')); }
    } catch { setJoinLookupError(t('mg.joinModal.err')); }
    finally { setJoinLookupLoading(false); }
  };

  const handleJoinByCode = async () => {
    if (!joinLookupResult) return;
    setJoinLoading(true);
    setJoinFeedback(null);
    try {
      const res = await fetch('/api/member/groups/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupCode: joinCode.trim().toUpperCase(), message: joinMessage }),
      });
      const d = await res.json();
      if (res.ok) {
        setJoinFeedback({ ok: true, msg: d.message });
        await Promise.all([loadMyGroups(), loadJoinRequests()]);
        if (d.joined && d.groupId) {
          setTimeout(() => { setShowJoinModal(false); router.push(`/member-dashboard/groups/${d.groupId}`); }, 1200);
        }
      } else {
        setJoinFeedback({ ok: false, msg: d.error || 'Imeshindikana kujiunga.' });
      }
    } catch { setJoinFeedback({ ok: false, msg: 'Hitilafu imetokea. Jaribu tena.' }); }
    finally { setJoinLoading(false); }
  };

  const resetJoinModal = () => {
    setShowJoinModal(false);
    setJoinCode('');
    setJoinLookupResult(null);
    setJoinLookupError('');
    setJoinMessage('');
    setJoinFeedback(null);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await fetch('/api/member/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          monthlyContribution: Number(createForm.monthlyContribution),
          votingNumerator: Number(createForm.votingNumerator),
          votingDenominator: Number(createForm.votingDenominator),
          contributionFrequency: createForm.contributionFrequency,
          logoUrl: createLogo,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setCreateForm({ name: '', monthlyContribution: '', votingNumerator: '3', votingDenominator: '5', contributionFrequency: 'monthly' });
        setCreateLogo(null);
        await loadMyGroups();
        if (data.group?.id) router.push(`/member-dashboard/groups/${data.group.id}`);
      } else {
        setCreateError(data.error || 'Imeshindikana kuunda kundi.');
      }
    } catch { setCreateError('Hitilafu imetokea. Jaribu tena.'); }
    finally { setCreateLoading(false); }
  };

  const statusConfig: Record<string, { label: string; cls: string }> = {
    pending:  { label: t('mg.status.pending'), cls: 'bg-yellow-500/15 text-yellow-400' },
    approved: { label: t('mg.status.approved'), cls: 'bg-emerald-500/15 text-emerald-400' },
    rejected: { label: t('mg.status.rejected'), cls: 'bg-red-500/15 text-red-400' },
  };

  return (
    <div className="space-y-6">

      {/* Header with Create Group button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-base font-semibold text-foreground">{t('mg.title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('mg.subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setCreateError(''); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-gold-deep text-foreground text-xs font-medium transition-colors"
        >
          <span className="text-base leading-none">+</span> {t('mg.create')}
        </button>
      </div>

      {myGroups.length > 0 ? (
        <>
          <div className="grid gap-3">
            {myGroups.map((g) => (
              <div
                key={g.id}
                onClick={() => router.push(`/member-dashboard/groups/${g.id}`)}
                className="rounded-xl bg-card border border-border hover:border-primary/30 p-5 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="shrink-0 h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-gold flex items-center justify-center text-white font-bold overflow-hidden">
                      {g.logo_url ? (
                        <img src={g.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        g.name.charAt(0).toUpperCase()
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-base font-semibold text-foreground truncate">{g.name}</h3>
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs bg-gold/10 text-gold">
                          {g.member_role || t('mg.role.member')}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('mg.status')}: {g.membership_status || g.status || 'active'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gold">
                      TSh {parseInt(g.monthly_contribution || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{g.contribution_frequency === 'weekly' ? t('mg.perWeek') : t('mg.perMonth')}</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{t('mg.tapToView')} →</p>
                  <div className="flex items-center gap-1.5">
                    <UserGroupIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground group-hover:text-gold transition-colors">{t('mg.view')} →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowJoinModal(true)}
            className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            + {t('mg.joinAnother')}
          </button>
        </>
      ) : (
        <div className="rounded-xl bg-card border border-border p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <UserGroupIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground mb-1 text-sm">{t('mg.emptyTitle')}</p>
          <p className="text-xs text-muted-foreground mb-5">{t('mg.emptyHint')}</p>
          <button
            onClick={() => setShowJoinModal(true)}
            className="px-5 py-2 rounded-lg bg-primary hover:bg-gold-deep text-foreground text-sm font-medium transition-colors"
          >
            {t('mg.joinCta')}
          </button>
        </div>
      )}

      {/* Pending join requests */}
      {joinRequests.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('mg.myRequests')}</h3>
          <div className="space-y-2">
            {joinRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm text-foreground">{r.group_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    TSh {parseInt(r.monthly_contribution).toLocaleString()}/{t('mg.month')} · {new Date(r.created_at).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB')}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${(statusConfig[r.status] || { cls: 'bg-white/5 text-muted-foreground' }).cls}`}>
                  {(statusConfig[r.status] || { label: r.status }).label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Group modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}
          >
            <h3 className="text-base font-semibold text-foreground mb-1">{t('mg.createNew.title')}</h3>
            <p className="text-xs text-muted-foreground mb-5">{t('mg.createNew.desc')}</p>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-2">{t('mg.field.logo')}</label>
                <AvatarPicker
                  value={createLogo}
                  onChange={setCreateLogo}
                  fallbackText={createForm.name || 'G'}
                  shape="square"
                  size={72}
                  label={t('mg.field.logoUpload')}
                  helper={t('mg.field.logoHelper')}
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('mg.field.name')} *</label>
                <input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('mg.field.namePh')}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/60"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {t('grp.freq.contribAmount')} ({createForm.contributionFrequency === 'weekly' ? t('grp.freq.weekly') : t('grp.freq.monthly')}) (TSh) *
                </label>
                <input
                  type="number"
                  value={createForm.monthlyContribution}
                  onChange={e => setCreateForm(f => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="Mfano: 50000"
                  min="1"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/60"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">{t('grp.freq.label')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['monthly', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setCreateForm(prev => ({ ...prev, contributionFrequency: f }))}
                      className={`py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                        createForm.contributionFrequency === f
                          ? 'bg-gold/15 border-gold/50 text-gold'
                          : 'bg-white/5 border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'monthly' ? t('grp.freq.monthly') : t('grp.freq.weekly')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('mg.field.voting')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={createForm.votingNumerator}
                    onChange={e => setCreateForm(f => ({ ...f, votingNumerator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground text-center focus:outline-none focus:border-gold/60"
                  />
                  <span className="text-muted-foreground text-sm">{t('mg.field.of')}</span>
                  <input
                    type="number"
                    value={createForm.votingDenominator}
                    onChange={e => setCreateForm(f => ({ ...f, votingDenominator: e.target.value }))}
                    min="1"
                    className="w-20 px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground text-center focus:outline-none focus:border-gold/60"
                  />
                  <span className="text-xs text-muted-foreground">{t('mg.field.pass')}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('mg.field.currently')}: {createForm.votingNumerator}/{createForm.votingDenominator} {t('mg.field.votesNeeded')}
                </p>
              </div>

              {createError && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{createError}</div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setCreateError(''); }}
                  className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
                >
                  {t('mg.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-gold-deep text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {createLoading ? t('mg.creating') : t('mg.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join by Code modal */}
      {showJoinModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <div
            className="bg-card border border-border rounded-t-3xl sm:rounded-2xl p-6 w-full max-w-md overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - 1rem)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold text-foreground">{t('mg.joinModal.title')}</h3>
              <button onClick={resetJoinModal} className="text-muted-foreground hover:text-muted-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-5">{t('mg.joinModal.desc')}</p>

            {/* Code input + search */}
            <div className="flex gap-2 mb-4">
              <input
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinLookupResult(null); setJoinLookupError(''); setJoinFeedback(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleLookupCode(); }}
                placeholder={t('mg.joinModal.codePh')}
                maxLength={12}
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:border-gold/60 uppercase tracking-wider"
              />
              <button
                onClick={handleLookupCode}
                disabled={joinLookupLoading || !joinCode.trim()}
                className="px-4 py-2.5 rounded-lg bg-primary hover:bg-gold-deep text-white text-sm font-medium disabled:opacity-50 transition-colors shrink-0"
              >
                {joinLookupLoading ? '...' : t('mg.joinModal.search')}
              </button>
            </div>

            {/* Lookup error */}
            {joinLookupError && (
              <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{joinLookupError}</div>
            )}

            {/* Group preview */}
            {joinLookupResult && !joinFeedback && (
              <div className="mb-4 rounded-xl bg-card border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{joinLookupResult.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('mg.joinModal.leader')}: {joinLookupResult.leader_name || t('mg.joinModal.unassigned')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gold">TSh {parseInt(joinLookupResult.monthly_contribution || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{joinLookupResult.contribution_frequency === 'weekly' ? t('mg.perWeek') : t('mg.perMonth')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border">
                  <span>{joinLookupResult.member_count} {t('mg.joinModal.members')}</span>
                  <span className="w-1 h-1 rounded-full bg-white/20" />
                  <span className={joinLookupResult.join_policy === 'open' ? 'text-emerald-400' : 'text-yellow-400'}>
                    {joinLookupResult.join_policy === 'open' ? t('mg.joinModal.open') : t('mg.joinModal.needsApproval')}
                  </span>
                </div>

                {joinLookupResult.join_policy !== 'open' && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">{t('mg.joinModal.messageLabel')}</label>
                    <textarea
                      value={joinMessage}
                      onChange={e => setJoinMessage(e.target.value)}
                      placeholder={t('mg.joinModal.messagePh')}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/60 resize-none"
                      rows={2}
                    />
                  </div>
                )}

                <button
                  onClick={handleJoinByCode}
                  disabled={joinLoading}
                  className="w-full py-2.5 rounded-lg bg-primary hover:bg-gold-deep text-white text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {joinLoading ? t('mg.joinModal.joining') : joinLookupResult.join_policy === 'open' ? t('mg.joinModal.joinNow') : t('mg.joinModal.sendReq')}
                </button>
              </div>
            )}

            {/* Success / error feedback */}
            {joinFeedback && (
              <div className={`px-3 py-3 rounded-lg text-sm text-center ${joinFeedback.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {joinFeedback.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MyInvestmentsSection({ memberInvestments }: { memberInvestments: any[] }) {
  const { t, language } = useLanguage();
  const totalInvestment = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const totalReturns = memberInvestments.reduce((sum, inv) => sum + parseFloat(inv.actual_return || 0), 0);
  const returnRate = totalInvestment > 0 ? ((totalReturns / totalInvestment) * 100).toFixed(1) : '0';

  const summaryCards = [
    { label: t('minv.totalInvested'), value: `TSh ${totalInvestment.toLocaleString()}`, accent: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: t('minv.netReturns'), value: `TSh ${totalReturns.toLocaleString()}`, accent: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: t('minv.returnRate'), value: `${returnRate}%`, accent: 'text-gold', bg: 'bg-gold/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map((c, i) => (
          <div key={i} className="rounded-xl bg-card border border-border p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-lg font-semibold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      {memberInvestments.length > 0 ? (
        <div className="rounded-xl bg-card border border-border overflow-hidden">
          {memberInvestments.map((inv, i) => (
            <div key={i} className="p-5 border-b border-border last:border-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{inv.group_name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(inv.investment_date).toLocaleDateString(language === 'sw' ? 'sw-TZ' : 'en-GB')}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  inv.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {inv.status === 'active' ? t('minv.active') : t('minv.pending')}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t('minv.amount'), value: `TSh ${parseFloat(inv.amount).toLocaleString()}` },
                  { label: t('minv.equity'), value: `${inv.equity_percentage}%` },
                  { label: t('minv.expectedReturn'), value: `TSh ${parseFloat(inv.expected_return || 0).toLocaleString()}` },
                  { label: t('minv.netReturns'), value: `TSh ${parseFloat(inv.actual_return || 0).toLocaleString()}` },
                ].map((item, j) => (
                  <div key={j} className="rounded-lg bg-card p-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-card border border-border p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <CurrencyDollarIcon className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t('minv.empty')}</p>
        </div>
      )}
    </div>
  );
}

function LearningSection({ memberTraining, user }: { memberTraining: any[]; user: any }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [coursesInProgress, setCoursesInProgress] = useState(0);
  const [certificatesCount, setCertificatesCount] = useState(0);

  React.useEffect(() => {
    // Count courses in progress
    const inProgress = memberTraining.filter((t: any) => t.progress_status === 'in_progress').length;
    setCoursesInProgress(inProgress);

    // Fetch certificate count
    if (user?.id) {
      fetch('/api/education/certificates')
        .then(r => r.ok ? r.json() : [])
        .then(d => {
          const certs = Array.isArray(d) ? d : d.certificates ?? [];
          setCertificatesCount(certs.length);
        })
        .catch(() => {});
    }
  }, [memberTraining, user?.id]);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl bg-card border border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center">
            <BookOpenIcon className="h-5 w-5 text-gold" />
          </div>
          <h3 className="text-base font-bold text-foreground">{t('edu.title')}</h3>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('edu.inProgress')}</p>
            <p className="text-2xl font-bold text-gold">{coursesInProgress}</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t('edu.certsEarned')}</p>
            <p className="text-2xl font-bold text-emerald-400">{certificatesCount}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/jifunze')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-gold-deep text-white transition-colors"
          >
            {t('edu.continue')}
          </button>
          <button
            onClick={() => router.push('/jifunze/vyeti')}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-muted hover:bg-border text-muted-foreground hover:text-foreground border border-border transition-colors"
          >
            {t('edu.myCerts')}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberSettingsSection({ onNavigate, user, memberProfile, loadMemberData }: {
  onNavigate: (section: string) => void;
  user: any;
  memberProfile: any;
  loadMemberData: () => void;
}) {
  const { t } = useLanguage();
  const [username, setUsername] = useState(memberProfile?.username || '');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile photo
  const [avatar, setAvatar] = useState<string | null>(memberProfile?.avatar_url ?? null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);
  const avatarDirty = (avatar ?? null) !== (memberProfile?.avatar_url ?? null);

  useEffect(() => {
    if (memberProfile?.username) setUsername(memberProfile.username);
    setAvatar(memberProfile?.avatar_url ?? null);
  }, [memberProfile]);

  const saveAvatar = async () => {
    if (!user?.id) return;
    setAvatarSaving(true); setAvatarSaved(false);
    try {
      // Patch-style: only avatar_url is written, the rest of the profile is untouched.
      const res = await fetch(`/api/members/profile?userId=${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarUrl: avatar }),
      });
      if (res.ok) {
        setAvatarSaved(true);
        loadMemberData();
        setTimeout(() => setAvatarSaved(false), 2500);
      }
    } catch (e) { console.error(e); }
    finally { setAvatarSaving(false); }
  };

  const checkUsername = async (val: string) => {
    if (!val || val.length < 3) {
      setUsernameStatus('idle');
      return;
    }
    setUsernameStatus('checking');
    try {
      const res = await fetch(`/api/member/username?check=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (res.ok && data.available) {
        setUsernameStatus('available');
        setUsernameError('');
      } else {
        setUsernameStatus('taken');
        setUsernameError(data.error || 'Username taken');
      }
    } catch {
      setUsernameStatus('invalid');
      setUsernameError('Error checking username');
    }
  };

  const handleUsernameChange = (val: string) => {
    const cleaned = val.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    setSaveSuccess(false);
    if (cleaned !== memberProfile?.username) {
      checkUsername(cleaned);
    } else {
      setUsernameStatus('idle');
    }
  };

  const saveUsername = async () => {
    if (!username || username === memberProfile?.username) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/member/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveSuccess(true);
        setUsernameStatus('idle');
        loadMemberData();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setUsernameError(data.error || 'Failed to save');
        setUsernameStatus('invalid');
      }
    } catch {
      setUsernameError('Network error');
      setUsernameStatus('invalid');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <button
        onClick={() => onNavigate('profile')}
        className="w-full flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:bg-muted transition-all text-left"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-gold flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 overflow-hidden">
          {memberProfile?.avatar_url ? (
            <img src={memberProfile.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg font-bold text-white">
              {(memberProfile?.full_name || user?.fullName || user?.email || 'U')[0].toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{memberProfile?.full_name || user?.fullName || t('prof.member')}</p>
          <p className="text-xs text-muted-foreground truncate">{memberProfile?.username ? `@${memberProfile.username}` : memberProfile?.email || user?.email}</p>
        </div>
        <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Profile photo */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t('set.field.avatar')}</h3>
        <p className="text-xs text-muted-foreground mb-4">{t('set.field.avatarHelper')}</p>
        <AvatarPicker
          value={avatar}
          onChange={setAvatar}
          fallbackText={memberProfile?.full_name || user?.fullName || 'U'}
          shape="circle"
          size={80}
          label={t('mg.field.logoUpload')}
        />
        {avatarDirty && (
          <button
            onClick={saveAvatar}
            disabled={avatarSaving}
            className="mt-4 w-full py-2.5 rounded-lg bg-primary hover:bg-gold-deep text-white text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {avatarSaving ? t('mg.creating') : t('grp.settings.save')}
          </button>
        )}
        {avatarSaved && (
          <p className="mt-3 text-xs text-emerald-500 text-center">✓ {t('grp.settings.saved')}</p>
        )}
      </div>

      {/* Username section */}
      <div className="rounded-2xl bg-card border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t('set.username.title')}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {memberProfile?.username 
            ? t('set.username.hasDesc')
            : t('set.username.noDesc')
          }
        </p>
        
        {memberProfile?.username ? (
          <div className="flex items-center justify-between p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <span className="text-emerald-400 text-lg">@</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-400">@{memberProfile.username}</p>
                <p className="text-xs text-muted-foreground">{t('set.username.yours')}</p>
              </div>
            </div>
            <div className="text-emerald-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="juma_ally"
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-gold/60"
                  pattern="[a-z0-9_]{3,30}"
                  minLength={3}
                  maxLength={30}
                />
                {usernameStatus === 'checking' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{t('set.username.checking')}</span>}
                {usernameStatus === 'available' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-400">{t('set.username.available')}</span>}
                {usernameStatus === 'taken' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-red-400">{t('set.username.taken')}</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t('set.username.hint')}</p>
              {usernameError && <p className="text-xs text-red-400 mt-1">{usernameError}</p>}
              {saveSuccess && <p className="text-xs text-emerald-400 mt-1">{t('set.username.saved')}</p>}
            </div>

            <button
              onClick={saveUsername}
              disabled={saving || usernameStatus !== 'available' || !username || username === memberProfile?.username}
              className="w-full py-2.5 rounded-lg bg-primary hover:bg-gold-deep text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? t('set.username.saving') : t('set.username.save')}
            </button>
          </div>
        )}
      </div>

      {/* Settings menu items */}
      <div className="rounded-2xl bg-card border border-border divide-y divide-white/[0.04]">
        {[
          { label: t('set.menu.account'), desc: t('set.menu.account.desc'), icon: UserIcon },
          { label: t('set.menu.security'), desc: t('set.menu.security.desc'), icon: CogIcon },
          { label: t('set.menu.notifications'), desc: t('set.menu.notifications.desc'), icon: DocumentTextIcon },
          { label: t('set.menu.language'), desc: 'Kiswahili / English', icon: BookOpenIcon },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-3.5 opacity-50">
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0">
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
            <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">{t('set.comingSoon')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
