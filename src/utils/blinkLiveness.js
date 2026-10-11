const EYE_OPEN_THRESHOLD = 0.70;
const EYE_CLOSED_THRESHOLD = 0.25;
const REQUIRED_STABLE_FRAMES = 2;

export function createBlinkLivenessState() {
  return {
    phase: 'looking_for_face',
    trackingId: null,
    stablePositionFrames: 0,
    openFrames: 0,
    closedFrames: 0,
    reopenedFrames: 0,
  };
}

export function advanceBlinkLiveness(previousState, faces, options = {}) {
  const isEnroll = Boolean(options?.isEnroll);

  if (!faces || faces.length === 0) {
    const wasWaiting =
      previousState.phase === 'waiting_for_blink' ||
      previousState.phase === 'waiting_for_reopen';
    return {
      state: createBlinkLivenessState(),
      prompt: wasWaiting
        ? 'Face not detected. Please try again.'
        : 'Position your face inside the frame.',
      complete: false,
    };
  }

  if (faces.length > 1) {
    return {
      state: createBlinkLivenessState(),
      prompt: 'Only one face should be visible.',
      complete: false,
    };
  }

  const face = faces[0];

  let state = previousState;
  if (
    state.trackingId !== null &&
    face.trackingId !== undefined &&
    face.trackingId !== state.trackingId
  ) {
    state = createBlinkLivenessState();
  }
  state = {...state, trackingId: face.trackingId ?? null};

  // Face distance/size check if frame bounds available
  if (face.bounds && face.frameWidth && face.frameWidth > 0) {
    const ratio = face.bounds.width / face.frameWidth;
    if (ratio < 0.18) {
      return {
        state: {...state, stablePositionFrames: 0},
        prompt: 'Move closer to the camera.',
        complete: false,
      };
    }
  }

  // Head orientation check if angles available
  if (
    (Number.isFinite(face.yawAngle) && Math.abs(face.yawAngle) > 22) ||
    (Number.isFinite(face.pitchAngle) && Math.abs(face.pitchAngle) > 22)
  ) {
    return {
      state: {...state, stablePositionFrames: 0},
      prompt: 'Please look directly at the camera.',
      complete: false,
    };
  }

  const {leftEyeOpenProbability: leftOpen, rightEyeOpenProbability: rightOpen} = face;

  if (!Number.isFinite(leftOpen) || !Number.isFinite(rightOpen)) {
    return {
      state: previousState,
      prompt: 'Please look directly at the camera.',
      complete: false,
    };
  }

  const eyesOpen =
    leftOpen >= EYE_OPEN_THRESHOLD && rightOpen >= EYE_OPEN_THRESHOLD;
  const eyesClosed =
    leftOpen <= EYE_CLOSED_THRESHOLD && rightOpen <= EYE_CLOSED_THRESHOLD;

  if (state.phase === 'looking_for_face' || state.phase === 'positioning') {
    if (!eyesOpen) {
      return {
        state: {...state, phase: 'positioning', openFrames: 0, stablePositionFrames: 0},
        prompt: 'Please look directly at the camera.',
        complete: false,
      };
    }

    const stablePositionFrames = state.stablePositionFrames + 1;
    const openFrames = state.openFrames + 1;

    if (stablePositionFrames < REQUIRED_STABLE_FRAMES) {
      return {
        state: {
          ...state,
          phase: 'positioning',
          stablePositionFrames,
          openFrames,
        },
        prompt: 'Hold still.',
        complete: false,
      };
    }

    return {
      state: {
        ...state,
        phase: 'waiting_for_blink',
        stablePositionFrames,
        openFrames,
        closedFrames: 0,
      },
      prompt: 'Please blink your eyes.',
      complete: false,
    };
  }

  if (state.phase === 'waiting_for_blink') {
    if (!eyesClosed) {
      return {
        state: {...state, closedFrames: 0},
        prompt: 'Please blink your eyes.',
        complete: false,
      };
    }

    const closedFrames = state.closedFrames + 1;
    const blinkStarted = closedFrames >= 1;
    return {
      state: {
        ...state,
        phase: blinkStarted ? 'waiting_for_reopen' : state.phase,
        closedFrames,
      },
      prompt: 'Hold still.',
      complete: false,
    };
  }

  if (state.phase === 'waiting_for_reopen') {
    if (!eyesOpen) {
      return {
        state: {...state, reopenedFrames: 0},
        prompt: 'Hold still.',
        complete: false,
      };
    }

    const reopenedFrames = state.reopenedFrames + 1;
    const complete = reopenedFrames >= 1;

    const completionPrompt = isEnroll
      ? 'Blink detected! Registering your face...'
      : 'Blink detected! Verifying your face...';

    return {
      state: {
        ...state,
        phase: complete ? 'complete' : state.phase,
        reopenedFrames,
      },
      prompt: completionPrompt,
      complete,
    };
  }

  return {
    state,
    prompt: isEnroll
      ? 'Blink detected! Registering your face...'
      : 'Blink detected! Verifying your face...',
    complete: state.phase === 'complete',
  };
}
