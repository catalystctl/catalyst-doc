/**
 * classify.mjs — deterministic change→documentation impact classification.
 *
 * Heuristic layers (no LLM needed):
 *  1. Path rules: changed files map to features + audiences.
 *  2. Frontmatter `sources` matching: pages that declared the changed code.
 *  3. Signal words in the diff file list (route/auth/permission/i18n keys).
 *
 * Output per analysis: { user, admin, apiGuides, apiReference, troubleshooting,
 * migration, internalOnly } each 'update required' | 'no change' (apiReference
 * uses 'regenerated' | 'unchanged'), plus affected features, candidate pages,
 * confidence, and review flags.
 *
 * The LLM (when configured) refines wording and drafts edits; it never
 * overrides a deterministic 'no change' into an update without evidence.
 */

const RULES = [
  // [pattern, { features, audiences }]
  [/routes\/backups\.ts|components\/backups|backup/i, { features: ['backups'], audiences: ['user', 'admin'] }],
  [/routes\/servers\/|pages\/servers|components\/servers|ServerDetailsPage|ServerConsolePage|ServerFilesPage/i, { features: ['servers'], audiences: ['user'] }],
  [/SftpConnectionInfo|ServerSftpTab|sftp_server\.rs/i, { features: ['sftp'], audiences: ['user'] }],
  [/routes\/tasks\.ts/i, { features: ['tasks'], audiences: ['user'] }],
  [/databases/i, { features: ['databases'], audiences: ['user'] }],
  [/deploy-agent\.sh|routes\/nodes\.ts|catalyst-agent\/src\/(config|updater|system_setup)/i, { features: ['nodes'], audiences: ['admin'] }],
  [/install\.sh|catalyst-docker\/|docker-compose|Caddyfile|traefik/i, { features: ['installation'], audiences: ['admin'] }],
  [/routes\/migration\.ts|MigrationPage|pterodactyl|egg/i, { features: ['migration', 'templates'], audiences: ['admin'] }],
  [/routes\/templates\.ts|routes\/nests\.ts|pages\/templates/i, { features: ['templates'], audiences: ['admin'] }],
  [/routes\/roles\.ts|RolesPage|permissions/i, { features: ['permissions'], audiences: ['admin', 'developer'] }],
  [/routes\/api-keys\.ts|ApiKeysPage/i, { features: ['api-auth'], audiences: ['developer', 'admin'] }],
  [/routes\/auth\.ts/i, { features: ['api-auth'], audiences: ['developer', 'admin'] }],
  [/error-codes\/|api-errors\.ts|errors\.json/i, { features: ['api-errors'], audiences: ['developer'] }],
  [/websocket\/gateway|console-stream|sse-events|metrics-stream/i, { features: ['websockets'], audiences: ['developer'] }],
  [/routes\/alerts\.ts|AlertsPage|routes\/metrics\.ts/i, { features: ['monitoring'], audiences: ['user', 'admin'] }],
  [/environment-variables|redis\.md|docker-setup/i, { features: ['configuration'], audiences: ['admin'] }],
  [/troubleshooting/i, { features: ['troubleshooting'], audiences: ['user', 'admin'] }],
];

const API_TOUCH = /routes\/|websocket\/|error-codes\/|shared-types\.ts|openapi/i;
const INTERNAL_ONLY = /__tests__|\.test\.|benchmarks?\/|e2e\/|review-.*\.md|PERFORMANCE_AUDIT|SESSION_BRIDGE|skills-lock|target\/|dist\//i;
// UI copy churn with no doc impact: locale-only edits outside structural keys.
const LOCALE_ONLY = /i18n\/locales\//i;

export function classifyFile(path) {
  for (const [re, info] of RULES) {
    if (re.test(path)) return { ...info, internalOnly: false };
  }
  return { features: [], audiences: [], internalOnly: INTERNAL_ONLY.test(path) };
}

export function analyzeChange(changedPaths) {
  const features = new Set();
  const audiences = new Set();
  const apiTouched = changedPaths.some((p) => API_TOUCH.test(p));
  const allInternal = changedPaths.length > 0 && changedPaths.every((p) => INTERNAL_ONLY.test(p));
  const localeOnly = changedPaths.length > 0 && changedPaths.every((p) => LOCALE_ONLY.test(p) || INTERNAL_ONLY.test(p));
  const permissionTouch = changedPaths.some((p) => /roles|permissions|api-keys|auth/i.test(p));
  const troubleshootingTouch = changedPaths.some((p) => /troubleshoot|error|fix|recover/i.test(p));

  for (const p of changedPaths) {
    const c = classifyFile(p);
    c.features.forEach((f) => features.add(f));
    c.audiences.forEach((a) => audiences.add(a));
  }

  const noDocImpact = allInternal || localeOnly;
  const impact = {
    user: !noDocImpact && audiences.has('user') ? 'update required' : 'no change',
    admin: !noDocImpact && audiences.has('admin') ? 'update required' : 'no change',
    apiGuides: !noDocImpact && (audiences.has('developer') || permissionTouch) ? 'update required' : 'no change',
    apiReference: apiTouched && !allInternal ? 'regenerated' : 'unchanged',
    troubleshooting: !noDocImpact && troubleshootingTouch ? 'update required' : 'no change',
    migration: !noDocImpact && features.has('migration') ? 'update required' : 'no change',
    internalOnly: noDocImpact ? 'yes' : 'no',
  };
  const confidence = changedPaths.length === 0
    ? 'low'
    : noDocImpact || features.size > 0
      ? 'high'
      : 'medium';
  return {
    impact,
    affectedFeatures: [...features],
    confidence,
    needsHumanReview: confidence !== 'high' || (impact.user === 'no change' && impact.admin === 'no change' && impact.apiGuides === 'no change' && impact.apiReference === 'unchanged' && changedPaths.length > 15),
  };
}

export function formatReport(analysis, extra = {}) {
  const i = analysis.impact;
  const lines = [
    'Documentation Impact',
    '',
    `USER:            ${i.user}`,
    `ADMIN:           ${i.admin}`,
    `API GUIDES:      ${i.apiGuides}`,
    `API REFERENCE:   ${i.apiReference}`,
    `TROUBLESHOOTING: ${i.troubleshooting}`,
    `MIGRATION:       ${i.migration}`,
    `INTERNAL ONLY:   ${i.internalOnly}`,
    '',
    `Affected features: ${analysis.affectedFeatures.join(', ') || '(none identified)'}`,
    `Confidence: ${analysis.confidence}`,
  ];
  if (extra.sourceFiles?.length) lines.push(`Source files examined: ${extra.sourceFiles.length}`);
  if (extra.pagesExamined?.length) lines.push(`Docs pages examined: ${extra.pagesExamined.join(', ')}`);
  if (extra.pagesChanged?.length) lines.push(`Docs pages changed: ${extra.pagesChanged.join(', ')}`);
  if (extra.reason) lines.push(`Reason: ${extra.reason}`);
  if (analysis.needsHumanReview) lines.push('Needs human review: yes — verify before merging.');
  return lines.join('\n');
}
