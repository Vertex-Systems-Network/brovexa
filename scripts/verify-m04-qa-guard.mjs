/** Guard destructive native M04 acceptance checks to a disposable LOCAL PostgreSQL database. */
export function validateM04QaEnvironment({ nodeVersion, pnpmVersion, databaseUrl, isolated, resetOptIn }) {
  const errors = [];
  if (nodeVersion !== 'v24.20.0') errors.push('Node.js v24.20.0 required.');
  if (pnpmVersion !== '11.23.0') errors.push('pnpm 11.23.0 required.');
  if (isolated !== 'true') errors.push('BROVEXA_M04_QA_ISOLATED=true required.');
  if (resetOptIn !== 'true') errors.push('BROVEXA_DB_TEST_ALLOW_RESET=true required.');
  try {
    const db = new URL(databaseUrl ?? '');
    if (!['postgres:', 'postgresql:'].includes(db.protocol)) errors.push('PostgreSQL connection required.');
    if (!['localhost', '127.0.0.1', '[::1]'].includes(db.hostname.toLowerCase())) {
      errors.push('Only loopback PostgreSQL is permitted for destructive QA.');
    }
    if (!/^\/brovexa_m04_qa_[a-z0-9_]+_test$/.test(db.pathname)) {
      errors.push('Database name must match brovexa_m04_qa_*_test (disposable test database).');
    }
    if (db.search || db.hash) errors.push('Database URL must not contain query or fragment.');
  } catch { errors.push('DATABASE_URL must be a valid PostgreSQL connection string.'); }
  return Object.freeze({ allowed: errors.length === 0, errors: Object.freeze(errors) });
}