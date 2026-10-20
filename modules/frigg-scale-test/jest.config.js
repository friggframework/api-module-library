module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^tools/scale-test/(.*)$': '<rootDir>/../../tools/scale-test/$1'
  }
};
