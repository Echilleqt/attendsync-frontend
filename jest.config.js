module.exports = {
  preset: '@react-native/jest-preset',
  transform: {
    '^.+\\.[cm]?[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
