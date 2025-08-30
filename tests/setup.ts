// Global test setup
global.console = {
  ...console,
  // Mock console.error to reduce noise in tests unless DEBUG is set
  error: process.env.DEBUG ? console.error : jest.fn(),
  warn: process.env.DEBUG ? console.warn : jest.fn(),
};

// Mock axios for tests
jest.mock('axios');

// Set test environment variables
process.env.NODE_ENV = 'test';