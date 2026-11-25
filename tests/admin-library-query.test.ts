jest.mock('@/features/admin/admin-api', () => ({ adminApi: {} }));

import { DEFAULT_LIBRARY_FILTERS } from '@/features/admin/types';
import { libraryQuery } from '@/stores/admin-store';

describe('admin library filters → API query', () => {
  it('sends no filters by default', () => {
    expect(libraryQuery(DEFAULT_LIBRARY_FILTERS)).toEqual({
      search: undefined, categoryId: undefined, minDifficulty: undefined, maxDifficulty: undefined, source: undefined,
    });
  });

  it('maps visibility to approval status + in-game switch', () => {
    expect(libraryQuery({ ...DEFAULT_LIBRARY_FILTERS, visibility: 'in_game' })).toMatchObject({ statuses: ['approved'], inGame: true });
    expect(libraryQuery({ ...DEFAULT_LIBRARY_FILTERS, visibility: 'hidden' })).toMatchObject({ statuses: ['approved'], inGame: false });
    expect(libraryQuery({ ...DEFAULT_LIBRARY_FILTERS, visibility: 'not_approved' }).statuses).toEqual(['pending', 'flagged', 'rejected']);
  });

  it('maps difficulty tier, category, source and trimmed search', () => {
    expect(libraryQuery({ search: '  privacy ', categoryId: 'data-privacy', tierId: 'advanced', source: 'ai', visibility: 'all' })).toEqual({
      search: 'privacy', categoryId: 'data-privacy', minDifficulty: 7, maxDifficulty: 8, source: 'ai',
    });
  });
});
