/**
 * Migration 001 — initial schema
 * Baseline: the schema already exists in production.
 * This migration is a no-op marker so node-pg-migrate
 * knows the starting point without re-running schema.sql.
 */
exports.up = () => {};
exports.down = () => {};
