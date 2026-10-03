-- Tenant context helper for PostgreSQL RLS (moved from infra/postgres/init.sql).
-- Sets per-session variables read by RLS policies:
--   app.current_company_id, app.is_super_admin
-- Called by PrismaService.setTenantContext().
CREATE OR REPLACE FUNCTION set_tenant_context(
  p_company_id TEXT,
  p_is_super_admin BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_company_id', COALESCE(p_company_id, ''), FALSE);
  PERFORM set_config('app.is_super_admin', p_is_super_admin::TEXT, FALSE);
END;
$$ LANGUAGE plpgsql;
