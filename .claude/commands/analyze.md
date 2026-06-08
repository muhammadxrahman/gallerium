Perform a deep analysis of the astronomy layer for correctness.

Check:
1. coordinates.ts — verify the equatorial to horizontal transform
2. sidereal.ts — verify GMST and LST calculations
3. planets.ts — verify Kepler solver convergence and orbital element application
4. moon.ts — verify Meeus term signs and argument ordering
5. satellites.ts — verify ECI to RA/Dec conversion

For each file:
- State what the code does
- Identify any mathematical errors or edge cases
- Cross-reference against the test expectations
- Flag anything that would cause visible position errors

Do NOT make any changes. Analysis only.