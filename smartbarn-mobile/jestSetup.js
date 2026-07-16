jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('./src/hooks/useSocket', () => ({
  useSocket: () => ({ data: {}, isConnected: false })
}));

jest.mock('./src/api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

// Mute console.error during tests to keep terminal output clean
console.error = jest.fn();
