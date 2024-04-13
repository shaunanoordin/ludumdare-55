export const TILE_SIZE = 32

/*
Each Entity has a physical shape.
 */
export const SHAPES = {
  NONE: 'none',
  CIRCLE: 'circle',
  SQUARE: 'square',
  POLYGON: 'polygon',
}

/*
Each Entity has a directional orientation, which can be interpreted as either
"rotation" (if we want to know the precise angle for physics calculations) or
"direction" (if we want to match it with up/down/left/right-facing sprites).
 */
export const ROTATIONS = {
  EAST: 0,
  SOUTHEAST: Math.PI * 0.25,
  SOUTH: Math.PI * 0.5,
  SOUTHWEST: Math.PI * 0.75,
  WEST: Math.PI,
  NORTHWEST: Math.PI * -0.75,
  NORTH: Math.PI * -0.5,
  NORTHEAST: Math.PI * -0.25,
}

export const DIRECTIONS = {
  EAST: 0,
  SOUTH: 1,
  WEST: 2,
  NORTH: 3,
}

export const POINTER_STATES = {
  IDLE: 'idle',  // Player isn't doing anything
  POINTER_DOWN: 'pointer down',  // Player is actively interacting with the canvas.
}

// Distance from its starting position that the pointer has to move, before a
// 'move' command is issued.
export const POINTER_DEADZONE_RADIUS = 16

// If the pointer is down and then released after a short time, it's a tap
// action. Otherwise, it's a hold action.
export const POINTER_TAP_DURATION = 300

/*
The paint() step (of the core engine, each Entity, and each Rule) can paint
information in different visual layers.
 */
export const LAYERS = {
  BACKGROUND: 0,  // Background layer, mostly for floors.
  ENTITIES_LOWER: 1,  // Main object layer.
  ENTITIES_UPPER: 2,  // Additional object layer (e.g. flying objects)
  HUD: 3,
}
export const MIN_LAYER = 0
export const MAX_LAYER = 3

/*
While the engine is technically able to support any given framerate (determined
by the hardware), a baseline is required to ground our video game logic to.
e.g. we can say that we expect an object with "movement speed" of "2" to travel
120 pixels in 1 second. (2 pixels per frame * 60 frames per second)
 */
export const EXPECTED_FRAMES_PER_SECOND = 60
export const EXPECTED_TIMESTEP = 1000 / EXPECTED_FRAMES_PER_SECOND
