-- ============================================================
-- PostgreSQL Initialization Script
-- Runs once when the container is first created.
-- Extensions needed by the HRMS portal.
-- ============================================================

-- UUID generation (used as primary keys everywhere)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions (used for token hashing, future pgcrypto option)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram indexes (enables fast ILIKE / fuzzy text search)
-- Used for employee name search, company search, etc.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Unaccent (removes accents from strings — useful for name search)
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================
-- Application DB configuration
-- ============================================================

-- Set default text search config to English
ALTER DATABASE hrms_dev SET default_text_search_config = 'pg_catalog.english';

-- Performance settings for local development
ALTER DATABASE hrms_dev SET statement_timeout = '30s';
ALTER DATABASE hrms_dev SET lock_timeout = '10s';

-- ============================================================
-- RLS helper function
-- Called by Prisma middleware to set tenant context
-- before executing any query.
-- Usage: SELECT set_tenant_context('company-uuid', false);
-- ============================================================

CREATE OR REPLACE FUNCTION set_tenant_context(
  p_company_id TEXT,
  p_is_super_admin BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_company_id', COALESCE(p_company_id, ''), FALSE);
  PERFORM set_config('app.is_super_admin', p_is_super_admin::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Log completion
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✅ PostgreSQL initialized: extensions enabled, RLS helper ready';
END $$;
