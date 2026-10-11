/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-vision-camera', () => ({
  useCameraDevice: () => null,
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: jest.fn(),
  }),
  usePhotoOutput: () => ({
    capturePhotoToFile: jest.fn(),
  }),
}));

jest.mock('react-native-vision-camera-face-detector', () => ({
  Camera: () => null,
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
