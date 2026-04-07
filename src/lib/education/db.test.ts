import { describe, it, expect, vi } from 'vitest';

// Mock the pg pool
vi.mock('@/lib/db', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockClient),
    },
    __mockClient: mockClient,
  };
});

import { getCategoriesPublished } from './db';

describe('getCategoriesPublished', () => {
  it('returns published categories with course counts', async () => {
    const { __mockClient: mockClient } = await import('@/lib/db') as any;
    mockClient.query.mockResolvedValueOnce({
      rows: [
        { id: 1, name: 'Ujuzi wa Fedha', description: 'Financial literacy', course_count: 3, total_duration: 120 },
      ],
    });

    const result = await getCategoriesPublished();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Ujuzi wa Fedha');
    expect(result[0].course_count).toBe(3);
    expect(mockClient.release).toHaveBeenCalled();
  });
});
