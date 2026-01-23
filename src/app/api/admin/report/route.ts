import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function parseMonthParam(month: string | null) {
  if (!month) return null;
  const m = month.trim();
  const match = /^([0-9]{4})-([0-9]{2})$/.exec(m);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) return null;
  return { year, monthIndex };
}

function monthStartIso({ year, monthIndex }: { year: number; monthIndex: number }) {
  const d = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0));
  return d.toISOString();
}

function nextMonthStartIso({ year, monthIndex }: { year: number; monthIndex: number }) {
  const d = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
  return d.toISOString();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const month = parseMonthParam(searchParams.get('month'));
  if (!month) {
    return NextResponse.json({ error: 'Invalid month. Expected YYYY-MM.' }, { status: 400 });
  }

  const startIso = monthStartIso(month);
  const endIso = nextMonthStartIso(month);

  const client = await pool.connect();

  try {
    const totalsRes = await client.query(
      `
      SELECT
        (SELECT COUNT(*) FROM members WHERE status = 'active') as total_members,
        (SELECT COUNT(*) FROM groups WHERE status = 'active') as total_groups,
        (SELECT COALESCE(SUM(total_investment), 0) FROM groups) as total_investment,
        (SELECT COALESCE(SUM(actual_return), 0) FROM investments WHERE status = 'active') as total_returns
      `
    );

    const monthlyCountsRes = await client.query(
      `
      SELECT
        (SELECT COUNT(*) FROM members WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz) as new_members,
        (SELECT COUNT(*) FROM groups WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz) as new_groups
      `,
      [startIso, endIso]
    );

    const monthlyContributionsRes = await client.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) as total_contributions,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_count,
        COUNT(*) as total_count
      FROM monthly_contributions
      WHERE contribution_month >= $1::date AND contribution_month < $2::date
      `,
      [startIso, endIso]
    );

    const monthlyInvestmentsRes = await client.query(
      `
      SELECT
        COALESCE(SUM(amount), 0) as investment_amount,
        COALESCE(SUM(actual_return), 0) as returns_amount,
        COUNT(*) as investment_count
      FROM investments
      WHERE investment_date >= $1::date AND investment_date < $2::date
      `,
      [startIso, endIso]
    );

    const businessRes = await client.query(
      `
      SELECT
        COUNT(*) as reports_count,
        COALESCE(SUM(revenue), 0) as revenue_sum,
        COALESCE(SUM(expenses), 0) as expenses_sum,
        COALESCE(SUM(profit), 0) as profit_sum,
        COALESCE(AVG(revenue), 0) as revenue_avg,
        COALESCE(AVG(profit), 0) as profit_avg
      FROM business_reports
      WHERE reporting_month >= $1::date AND reporting_month < $2::date
      `,
      [startIso, endIso]
    );

    const prevBusinessRes = await client.query(
      `
      WITH current_month AS (
        SELECT date_trunc('month', $1::timestamptz) as m
      )
      SELECT
        COALESCE(SUM(revenue), 0) as revenue_sum,
        COALESCE(SUM(expenses), 0) as expenses_sum,
        COALESCE(SUM(profit), 0) as profit_sum
      FROM business_reports
      WHERE reporting_month >= (SELECT m - interval '1 month' FROM current_month)
        AND reporting_month < (SELECT m FROM current_month)
      `,
      [startIso]
    );

    const genderRes = await client.query(
      `
      SELECT
        COALESCE(NULLIF(LOWER(TRIM(gender)), ''), 'haijatajwa') as gender,
        COUNT(*) as count
      FROM members
      WHERE status = 'active'
      GROUP BY COALESCE(NULLIF(LOWER(TRIM(gender)), ''), 'haijatajwa')
      ORDER BY count DESC
      `
    );

    const trendsRes = await client.query(
      `
      WITH months AS (
        SELECT (date_trunc('month', $1::timestamptz) - interval '5 months') + (n || ' months')::interval AS month_start
        FROM generate_series(0, 5) AS n
      )
      SELECT
        to_char(month_start, 'YYYY-MM') as month,
        (SELECT COUNT(*) FROM members WHERE created_at < (month_start + interval '1 month')) as members,
        (SELECT COUNT(*) FROM groups WHERE created_at < (month_start + interval '1 month')) as groups,
        (SELECT COALESCE(SUM(amount), 0) FROM monthly_contributions WHERE contribution_month >= month_start::date AND contribution_month < (month_start + interval '1 month')::date) as contributions,
        (SELECT COALESCE(SUM(revenue), 0) FROM business_reports WHERE reporting_month >= month_start::date AND reporting_month < (month_start + interval '1 month')::date) as revenue,
        (SELECT COALESCE(SUM(profit), 0) FROM business_reports WHERE reporting_month >= month_start::date AND reporting_month < (month_start + interval '1 month')::date) as profit
      FROM months
      ORDER BY month_start
      `,
      [startIso]
    );

    const totals = totalsRes.rows[0];
    const monthlyCounts = monthlyCountsRes.rows[0];
    const contributions = monthlyContributionsRes.rows[0];
    const monthlyInvestments = monthlyInvestmentsRes.rows[0];
    const business = businessRes.rows[0];
    const prevBusiness = prevBusinessRes.rows[0];

    const totalInvestment = Number(totals.total_investment || 0);
    const totalReturns = Number(totals.total_returns || 0);
    const returnRate = totalInvestment > 0 ? (totalReturns / totalInvestment) * 100 : 0;

    return NextResponse.json({
      month: `${String(month.year).padStart(4, '0')}-${String(month.monthIndex).padStart(2, '0')}`,
      period: {
        start: startIso,
        end: endIso
      },
      totals: {
        totalMembers: Number(totals.total_members || 0),
        totalGroups: Number(totals.total_groups || 0),
        totalInvestment: totalInvestment,
        totalReturns: totalReturns,
        returnRate
      },
      monthly: {
        newMembers: Number(monthlyCounts.new_members || 0),
        newGroups: Number(monthlyCounts.new_groups || 0),
        contributionsTotal: Number(contributions.total_contributions || 0),
        contributionsPaidCount: Number(contributions.paid_count || 0),
        contributionsTotalCount: Number(contributions.total_count || 0),
        investmentsAmount: Number(monthlyInvestments.investment_amount || 0),
        investmentsCount: Number(monthlyInvestments.investment_count || 0),
        returnsAmount: Number(monthlyInvestments.returns_amount || 0),
        businessReportsCount: Number(business.reports_count || 0),
        revenueSum: Number(business.revenue_sum || 0),
        expensesSum: Number(business.expenses_sum || 0),
        profitSum: Number(business.profit_sum || 0),
        revenueAvg: Number(business.revenue_avg || 0),
        profitAvg: Number(business.profit_avg || 0),
        prevRevenueSum: Number(prevBusiness.revenue_sum || 0),
        prevProfitSum: Number(prevBusiness.profit_sum || 0)
      },
      special: {
        gender: genderRes.rows.map((r) => ({ gender: String(r.gender), count: Number(r.count || 0) }))
      },
      trends: trendsRes.rows.map((r) => ({
        month: String(r.month),
        members: Number(r.members || 0),
        groups: Number(r.groups || 0),
        contributions: Number(r.contributions || 0),
        revenue: Number(r.revenue || 0),
        profit: Number(r.profit || 0)
      }))
    });
  } catch (error) {
    console.error('Report data error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    client.release();
  }
}
