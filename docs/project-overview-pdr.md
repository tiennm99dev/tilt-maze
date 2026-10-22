# Project overview

Tilt Maze is a browser game: hold a phone, tilt it, and roll a marble through a 3D maze to the
goal ring. A hard shake makes the marble jump, which can hop an inner wall or throw it off the
board. It was built as a personal game; anyone is welcome to play it.

## Goals

- Phone first. Tilt is the main control; it must work in Safari on iOS and Chrome on Android,
  in portrait and both landscape directions, at whatever angle the player holds the phone.
- Falling off is part of the game. Walls are low and the edges are open, so a deliberate shake
  can send the ball flying, while ordinary tilting never does.
- Playable everywhere else too: keyboard and pointer drag on desktop, and drag on phones whose
  sensors are blocked (in-app browsers, denied permission).
- No server, no accounts. Progress stays in the browser.

## Non-goals

Lives and game over, a follow camera, moving traps, a level editor, online leaderboards,
textures and post-processing, offline/PWA install, and translations. The reasons are in the
[plan](../plans/261022-1919-tilt-maze-mvp/plan.md).

## Terms

- **Board tilt**: the angle the board is drawn at and that gravity is rotated by, capped at 15°.
- **Phone tilt**: the phone's angle away from the calibrated neutral pose.
- **Calibration**: taking the current hold angle as neutral (zero tilt).
- **Shake**: a `devicemotion` spike above the threshold; it kicks the ball upward.
- **Fall**: the ball dropping through a hole or off an edge; it respawns at the start with a
  5-second penalty.
- **Campaign**: ten fixed levels unlocked in order. **Endless**: a fresh random maze each time.
