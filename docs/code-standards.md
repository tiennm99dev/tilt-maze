# Code standards

- **Plain JavaScript ES modules with JSDoc types.** No TypeScript source files; one language in
  the repo. `npm run typecheck` runs `tsc` with `checkJs` and `strict` over `jsconfig.json`.
- **TypeScript 7 checks the JSDoc.** It dropped Closure-era JSDoc: no `@enum`, no
  `@constructor` functions, no `function(string): void` types, no postfix `!`. Use ES classes,
  arrow-style types (`(a: number) => void`) and `import('module').Type`.
- **Browser APIs missing from lib.dom** (such as iOS `requestPermission`) get a JSDoc typedef
  and a cast at the call site, not a `.d.ts` file. See `src/input/sensors.js`.
- **Lint:** ESLint flat config with `eslint-plugin-jsdoc` (`recommended-typescript-flavor`).
  The lint run must finish with no warnings.
- **Constants** go in `src/tuning.js`, not inline.
- **Testing boundary:** logic that can run without a DOM or WebGL lives in pure modules and has
  Vitest specs in `tests/unit/`. Browser glue is covered by the single Playwright smoke spec.
  When a bug turns up in glue code, move the logic into a pure module and test it there.
- **Physics engine calls** stay in `src/physics/world.js`.
- **Teardown:** anything that owns GPU resources, listeners or a physics world exposes
  `dispose()`.
- **Dependencies:** npm only, one `package-lock.json`. `.npmrc` sets `min-release-age=3`, so a
  release younger than three days is not installed. `three` and `@types/three` move together.
- **Commits:** Conventional Commits.
