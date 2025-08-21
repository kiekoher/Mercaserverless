module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFiles: ['<rootDir>/jest.env.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.polyfill.js', '<rootDir>/jest.setup.js', 'jest-canvas-mock'],
  moduleNameMapper: {
    // Handle CSS imports (if you're not using CSS modules)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle module aliases
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/pages/(.*)$': '<rootDir>/pages/$1',
    '^@/context/(.*)$': '<rootDir>/context/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/.next/'],
  transform: {
    // Use babel-jest to transpile tests with the next/babel preset
    // https://jestjs.io/docs/configuration#transform-objectstring-pathtotransformer--pathtotransformer-object
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@supabase|isows|@supabase/realtime-js|p-limit)/)',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
};
