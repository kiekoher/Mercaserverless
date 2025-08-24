/**
 * Creates a comprehensive, chainable mock of the Supabase client for testing.
 * @param {object} [dataOverrides={}] Optional data to override the default mock responses.
 * @param {object} [dataOverrides.user] The mock user object to be returned by auth.getUser.
 * @param {object} [dataOverrides.single] The mock data for a .single() query.
 * @param {Array} [dataOverrides.list] The mock data for a list query (e.g., .select()).
 * @param {Error} [dataOverrides.error] A mock error to be returned by queries.
 * @param {number} [dataOverrides.count] A mock count for list queries with { count: 'exact' }.
 */
export const createMockSupabaseClient = (dataOverrides = {}) => {
  const mockData = {
    user: null,
    single: {},
    list: [],
    error: null,
    count: dataOverrides.list?.length || 0,
    ...dataOverrides,
  };

  const queryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: mockData.single, error: mockData.error }),
  };

  // This makes the queryBuilder "thenable" for list results, simulating how Supabase client works.
  // e.g., `await supabase.from('...').select()`
  queryBuilder.then = (resolve) => resolve({ data: mockData.list, error: mockData.error, count: mockData.count });

  const client = {
    from: jest.fn(() => queryBuilder),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: mockData.user },
        error: mockData.error,
      }),
    },
  };

  return client;
};
