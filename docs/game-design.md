# Game design

All tuning numbers live in [`src/tuning.js`](../src/tuning.js). This file records why they are
set the way they are, so a later change can be made on purpose.

## Tilt

- **Gravity vector, not Euler angles.** Beta and gamma are turned into the direction of "up" in
  the phone's frame. Angles jump when gamma wraps at ±90°; the vector does not, and calibration
  at a steep hold angle stays correct (unit tests prove both).
- **Calibration is a rotation**, not a subtracted baseline angle. Subtracting distorts left and
  right when the phone is held steeply. The neutral pose is averaged over 250 ms.
- **Filter order:** smoothing (80 ms time constant, independent of frame rate), then a 2° radial
  dead zone, then a linear map from 25° of phone tilt to 15° of board tilt, then sensitivity
  and invert. The dead zone is rescaled so the output starts at zero at its edge instead of
  jumping. A One Euro filter would cut lag further; it waits until play-testing shows the lag.
- **15° board cap.** Steeper boards only press the ball into walls, and the cap is what keeps
  ordinary tilting from ever throwing the ball over the rim.
- **Landscape.** The screen angle rotates the device axes into screen axes. Browsers have
  disagreed about the sign of that angle, so `TILT.screenAngleSign` flips it in one place if a
  real device shows the ball rolling the wrong way. The neutral pose is kept in screen axes, so
  it stays valid after a rotation. A rotation during play pauses the game instead of
  recalibrating: it is usually the OS reacting to a hard tilt, and the resume tap recalibrates
  from a pose the player chose.

## Shake and flying off

- Shake uses the magnitude of `devicemotion` acceleration, never the sign of single axes,
  because axis signs differ between browsers. Above 15 m/s² (about 1.5 g) counts, with a
  500 ms cooldown so one jolt is one jump.
- The kick goes up plus toward wherever the board leans, and grows with how far the shake
  exceeds the threshold, capped at 2×. It only applies when the ball rests on a surface, so
  there are no mid-air double jumps.
- Wall heights set the outcome. The ball is 0.5 across. The rim is 0.35 high (0.7 diameters)
  and inner walls 0.6 (1.2 diameters). Simulated with the shipped values: a shake right at the
  threshold lifts the ball's centre to about 0.47 (no escape), about 1.3× clears the rim, and
  about 1.7× or more hops an inner wall. Space on a keyboard is a 1.8× shake.
- The ball uses continuous collision detection, so a hard fling cannot pass through a thin wall
  (a 25 units/s fling into a wall was simulated). Sleeping is off, because the physics engine
  does not wake a body when gravity turns.

## Levels

- Mazes come from a seeded generator (Growing Tree, growing from the newest cell 90% of the
  time), so every campaign level is the same for everyone and can be rebuilt from its seed.
  Newest-cell growth gives long, winding corridors with few dead ends, which suits steering a
  ball.
- Grids grow from 5×5 to 11×11. Larger grids make the ball too small on a phone screen.
- From level 4, a share of the inner walls (up to 15% on the last levels) is removed to add
  loops: a safe long way and a risky short way.
- Holes go on the shortest route (otherwise nobody meets them), never in the start cell, the
  cell after it, or the goal, and never in two neighbouring route cells. Each hole sits against
  a closed wall and leaves a lane 1.5 ball diameters wide, so no hole forces a fall. Holes are
  square openings so what is drawn matches what the ball falls through.
- Density rises from no holes on level 1 to 0.12 holes per route cell on level 10. A test
  checks that size and density never decrease from one level to the next, and a simulated
  autopilot finished all ten campaign levels without falling.

## Falls and scoring

There are no lives. A fall costs a respawn at the start and 5 seconds. Time is the score, so
mistakes already cost something and best times still mean something. The timer starts on the
first input, not when the level appears, so permission prompts and calibration never count.
It adds only simulated time, so a stalling phone is not charged for frames physics dropped.
Endless keeps one best time across all its random mazes: a record for the fastest maze ever
cleared, not a per-maze best.

## Look

A fixed camera above the board, leaned 20° toward the player, keeps the whole maze visible and
makes the tilt readable from perspective and shading; a follow camera would hide most of the
maze. One shadow-casting light (1024 map, plain PCF filtering, cheaper on phones than soft PCF)
plus a sky light; the ball's shadow shows when it is in the air. Flat colours, one merged mesh
for the floor and one for the walls, pixel ratio capped at 2, and no post-processing keep each
frame cheap on mid-range phones.

## Sound

Effects are synthesised in code (rolling noise that follows speed, wall knocks, a falling tone,
a short arpeggio on win), so there are no audio files to load. Vibration is used where the
browser supports it, which in practice means Android.
