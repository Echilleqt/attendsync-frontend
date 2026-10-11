import {
  advanceBlinkLiveness,
  createBlinkLivenessState,
} from '../src/utils/blinkLiveness';

function face(leftEyeOpenProbability, rightEyeOpenProbability, trackingId = 1, extra = {}) {
  return {leftEyeOpenProbability, rightEyeOpenProbability, trackingId, ...extra};
}

function advance(state, left, right, trackingId = 1, extra = {}) {
  return advanceBlinkLiveness(state, [face(left, right, trackingId, extra)]);
}

test('requires stable position, blink eyes prompt, and full open-closed-open transition', () => {
  let state = createBlinkLivenessState();

  // Frame 1: face detected, stabilizing
  let result = advance(state, 0.9, 0.9);
  state = result.state;
  expect(result.complete).toBe(false);
  expect(result.prompt).toBe('Hold still.');

  // Frame 2: stable position reached, asks to blink
  result = advance(state, 0.9, 0.9);
  state = result.state;
  expect(result.prompt).toBe('Please blink your eyes.');

  // Frame 3: eyes close
  result = advance(state, 0.1, 0.1);
  state = result.state;
  expect(result.complete).toBe(false);
  expect(result.prompt).toBe('Hold still.');

  // Frame 4: eyes reopen
  result = advance(state, 0.9, 0.9);
  expect(result.complete).toBe(true);
  expect(result.prompt).toBe('Blink detected! Verifying your face...');
});

test('supports isEnroll prompt variation', () => {
  let state = createBlinkLivenessState();
  state = advance(state, 0.9, 0.9).state;
  state = advance(state, 0.9, 0.9).state;
  state = advance(state, 0.1, 0.1).state;
  const result = advanceBlinkLiveness(state, [face(0.9, 0.9)], {isEnroll: true});
  expect(result.complete).toBe(true);
  expect(result.prompt).toBe('Blink detected! Registering your face...');
});

test('prompts to move closer if face is too small in frame', () => {
  const state = createBlinkLivenessState();
  const smallFace = face(0.9, 0.9, 1, {
    bounds: {width: 100, height: 100, x: 0, y: 0},
    frameWidth: 1000,
    frameHeight: 1000,
  });
  const result = advanceBlinkLiveness(state, [smallFace]);
  expect(result.prompt).toBe('Move closer to the camera.');
});

test('prompts to look directly at camera if yaw or pitch is tilted', () => {
  const state = createBlinkLivenessState();
  const tiltedFace = face(0.9, 0.9, 1, {
    yawAngle: 35,
    pitchAngle: 0,
  });
  const result = advanceBlinkLiveness(state, [tiltedFace]);
  expect(result.prompt).toBe('Please look directly at the camera.');
});

test('resets when multiple faces appear', () => {
  let state = createBlinkLivenessState();
  state = advance(state, 0.9, 0.9).state;
  state = advance(state, 0.9, 0.9).state;
  expect(state.phase).toBe('waiting_for_blink');

  const result = advanceBlinkLiveness(state, [face(0.9, 0.9), face(0.9, 0.9, 2)]);
  expect(result.state.phase).toBe('looking_for_face');
  expect(result.prompt).toBe('Only one face should be visible.');
});

test('prompts position face when no faces are detected', () => {
  const state = createBlinkLivenessState();
  const result = advanceBlinkLiveness(state, []);
  expect(result.prompt).toBe('Position your face inside the frame.');
});

test('restarts the challenge if the tracked face changes during the scan', () => {
  let state = createBlinkLivenessState();
  state = advance(state, 0.9, 0.9, 1).state;
  state = advance(state, 0.9, 0.9, 1).state;

  const result = advance(state, 0.9, 0.9, 2);
  expect(result.state.phase).toBe('positioning');
  expect(result.state.stablePositionFrames).toBe(1);
});
