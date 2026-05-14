'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from '@/contexts/ThemeContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface GrowthChartProps {
  memberCount: number;
  groupCount: number;
}

export default function GrowthChart({ memberCount, groupCount }: GrowthChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (!memberCount && !groupCount) {
    return (
      <div className="h-64 w-full flex items-center justify-center bg-muted rounded-lg">
        <p className="text-muted-foreground">Loading chart data...</p>
      </div>
    );
  }

  const generateGrowthData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const memberGrowth = [];
    const groupGrowth = [];
    for (let i = 0; i < months.length; i++) {
      memberGrowth.push(Math.max(1, Math.floor((memberCount * (i + 1)) / months.length)));
      groupGrowth.push(Math.max(1, Math.floor((groupCount * (i + 1)) / months.length)));
    }
    return { months, memberGrowth, groupGrowth };
  };

  const { months, memberGrowth, groupGrowth } = generateGrowthData();

  const axisColor = isDark ? 'rgba(255,255,255,0.35)' : '#9ca3af';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const legendColor = isDark ? 'rgba(255,255,255,0.6)' : '#6b7280';

  const data = {
    labels: months,
    datasets: [
      {
        label: 'Wanachama (Members)',
        data: memberGrowth,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Vikundi (Groups)',
        data: groupGrowth,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          padding: 20,
          color: legendColor,
        },
      },
      title: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.98)',
        titleColor: isDark ? '#fff' : '#111827',
        bodyColor: isDark ? 'rgba(255,255,255,0.7)' : '#4b5563',
        borderColor: 'rgba(249, 115, 22, 0.4)',
        borderWidth: 1,
      },
    },
    interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
    scales: {
      x: {
        display: true,
        title: { display: true, text: 'Mwezi (Month)', color: axisColor },
        ticks: { color: axisColor },
        grid: { display: false },
      },
      y: {
        display: true,
        title: { display: true, text: 'Idadi (Count)', color: axisColor },
        ticks: { color: axisColor },
        beginAtZero: true,
        grid: { color: gridColor },
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Line data={data} options={options} />
    </div>
  );
}
