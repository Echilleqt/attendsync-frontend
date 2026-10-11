import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 10, left: 0, right: 0 }),
}));

import AppHeader from '../src/components/AppHeader';

describe('AppHeader Reusable Component', () => {
  it('renders standard variant with title and school name', () => {
    let tree;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <AppHeader
          title="Daily Attendance"
          subtitle="Biometric time recording"
          schoolName="BANSUD CENTRAL SCHOOL"
        />,
      );
    });

    const json = tree.toJSON();
    expect(json).toBeDefined();
    const str = JSON.stringify(json);
    expect(str).toContain('Daily Attendance');
    expect(str).toContain('BANSUD CENTRAL SCHOOL');
  });

  it('renders expanded variant with greeting', () => {
    let tree;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <AppHeader
          variant="expanded"
          title="ATTENDSYNC"
          greeting="Good day, Maria"
          schoolName="BANSUD CENTRAL SCHOOL"
        />,
      );
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).toContain('Good day, Maria');
    expect(str).toContain('ATTENDSYNC');
  });

  it('renders compact variant with back navigation button', () => {
    const onBack = jest.fn();
    let tree;
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <AppHeader
          variant="compact"
          title="Attendance History"
          onBack={onBack}
        />,
      );
    });

    const str = JSON.stringify(tree.toJSON());
    expect(str).toContain('Attendance History');
  });
});
