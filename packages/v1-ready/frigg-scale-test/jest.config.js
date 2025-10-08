module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^services/(.*)$': '<rootDir>/../../../services/$1'
  }
};
