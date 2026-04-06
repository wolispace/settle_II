// playStateArray indexes
export const PLAYER_STATE_ARRAY_INDEXES = {
    CAMERA_X_MIN:        0,
    CAMERA_Y_MIN:        1,
    CAMERA_X_MAX:        2,
    CAMERA_Y_MAX:        3,
    MOUSE_X:             4,
    MOUSE_Y:             5,
    SELECTED_HOUSE_TYPE: 6
}


export const HEX_RADIUS = 10;
export const MAX_MOVABLES = 20_000;

export const NUM_EXTRA_BITS = 1; // at the moment we're just storing an extra bit for whether the movablePositions is currently locked or not
export const MAX_SCHEDULE_DURATION_MS = 32_000;
export const TICK_PERIOD_MS = 250;