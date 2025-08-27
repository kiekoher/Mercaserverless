module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  // setupFilesAfterEnv runs before each test file.
  // We include our new env setup first.
  setupFilesAfterEnv: ['<rootDir>/jest.setup-env.js', '<rootDir>/jest.setup.js', 'jest-canvas-mock'],
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
    '^.+\\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        presets: ['next/babel'],
        plugins: ['@babel/plugin-transform-unicode-property-regex'],
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(p-retry|is-network-error|@supabase/ssr|@supabase/realtime-js|isows|p-limit|yocto-queue)/)",
    '^.+\\.module\\.(css|sass|scss)$',
  ],
};
