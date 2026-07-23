/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['./test/jest.setup.ts'],
  roots: ['./test'],
  // msw@2 and several of its transitive deps (rettime, until-async,
  // @open-draft/deferred-promise, @bundled-es-modules/*, ...) ship ESM-only
  // builds. jest runs ts-jest in CommonJS, so those `.mjs`/ESM files fail to
  // parse ("Cannot use import statement outside a module"). We transpile them to
  // CommonJS by (1) un-ignoring the msw ecosystem in transformIgnorePatterns and
  // (2) letting ts-jest handle .js/.mjs with `module: CommonJS`.
  transform: {
    '^.+\\.m?[tj]sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          allowJs: true,
          module: 'CommonJS',
          moduleResolution: 'Node',
          // TS 6.x flags `moduleResolution: node10` as deprecated; we only need
          // it here to transpile ESM deps to CommonJS, so silence the notice.
          ignoreDeprecations: '6.0',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(msw|@mswjs|@open-draft|@bundled-es-modules|@ungap|rettime|until-async|strict-event-emitter|headers-polyfill|outvariant|is-node-process|graphql)/)',
  ],
};
