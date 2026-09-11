// Dependency-boundary enforcement for the feature-first migration.
// Rules 3 + 5 (consume a feature only via its index.ts) are generated per
// consumer/target pair so that imports *within* one feature stay legal
// while imports into a *sibling* feature's internals warn. Legacy paths
// (src/ui, src/core, ...) are intentionally out of scope until their
// migration phase. Severity is warn during migration, error once complete.
const FEATURES = [
  'disasters',
  'export',
  'export-minecraft',
  'export-print',
  'fuel',
  'map',
  'navigation',
  'routing',
  'search',
  'shelters',
  'storytelling',
  'survey',
  'traffic',
  'weather',
];

const CONSUMERS = ['app', ...FEATURES.map((f) => `features/${f}`)];

function indexOnlyRules() {
  const rules = [];
  for (const consumer of CONSUMERS) {
    const consumerFeature = consumer.startsWith('features/') ? consumer.slice('features/'.length) : null;
    for (const target of FEATURES) {
      if (target === consumerFeature) continue; // own internals are fine
      rules.push({
        name: `no-internals:${consumer}>${target}`,
        severity: 'warn',
        comment:
          'Rules 3 + 5: a feature may be consumed only through its public index.ts, never its internals.',
        from: { path: `^src/${consumer}` },
        to: {
          path: `^src/features/${target}/.+`,
          pathNot: [`^src/features/${target}/index\\.ts$`],
        },
      });
    }
  }
  return rules;
}

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    ...indexOnlyRules(),
    {
      // Rule 4: shared must never import from features.
      name: 'no-shared-to-features',
      severity: 'warn',
      from: { path: '^src/shared' },
      to: { path: '^src/features' },
    },
    {
      // Rule 1 (inverse): a feature may import from shared, never from app.
      name: 'no-feature-to-app',
      severity: 'warn',
      from: { path: '^src/features' },
      to: { path: '^src/app' },
    },
    {
      // Rule 7: no circular dependencies between features (scoped to the
      // new structure; legacy cycles are out of scope for this migration).
      name: 'no-circular',
      severity: 'warn',
      from: { path: '^src/(app|features|shared)' },
      to: { circular: true, path: '^src/(app|features|shared)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
