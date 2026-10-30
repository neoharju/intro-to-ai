// Dead reckoning on a robot that is told to drive a regular polygon: "drive one side, turn left by
// 360°/n" over and over. The commands are perfect; the execution is not. Each side comes out a few per
// cent too long or too short (wheel slip), and each turn is off by a little (imperfect odometry).
//
// Without feedback the robot only knows the commands it gave, so the heading errors add up and the
// path wanders off. With a position fix (a landmark, a beacon, a camera), the robot measures where it
// really is at the fix and aims the next side at the corner where it should be, so the errors do not
// add up.

// The corners of the planned polygon, starting at the origin and heading along the x axis.
export function plannedCorners(sides) {
  const corners = [[0, 0]];
  let x = 0;
  let y = 0;

  for (let i = 0; i < sides; i++) {
    const heading = (i * 2 * Math.PI) / sides;

    x += Math.cos(heading);
    y += Math.sin(heading);
    corners.push([x, y]);
  }

  return corners;
}

// One drive of `laps` laps. slip is the relative standard deviation of a side's length, turnError the
// standard deviation of a turn in radians; normal() draws a standard normal number. fixEvery = 0 means
// no feedback; otherwise the robot measures its position after every fixEvery sides.
export function drive({ sides, laps, slip, turnError, fixEvery, normal }) {
  const corners = plannedCorners(sides);
  const steps = sides * laps;
  const path = [[0, 0]];
  let x = 0;
  let y = 0;
  let heading = 0;

  for (let i = 0; i < steps; i++) {
    let length = 1;

    if (i > 0) {
      const fixed = fixEvery > 0 && i % fixEvery === 0;

      if (fixed) {
        // Measure the position and aim straight at the corner where the robot should be next.
        const [tx, ty] = corners[(i % sides) + 1];

        heading = Math.atan2(ty - y, tx - x);
        length = Math.hypot(tx - x, ty - y);
      } else {
        heading += (2 * Math.PI) / sides;
      }

      heading += turnError * normal();
    }

    length *= 1 + slip * normal();
    x += length * Math.cos(heading);
    y += length * Math.sin(heading);
    path.push([x, y]);
  }

  return path;
}

// How far the end of a path is from where it should be (the start: every lap ends there).
export const miss = path => Math.hypot(path[path.length - 1][0], path[path.length - 1][1]);
