module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 45,
      functions: 55,
      lines: 55,
      statements: 55,
    },
    // Stricter thresholds for critical security components
    './src/services/dlp-scanner.ts': {
      branches: 70,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    './src/services/policy-evaluator.ts': {
      branches: 50,
      functions: 70,
      lines: 68,
      statements: 65,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
