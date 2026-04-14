# Regulatory Readiness Baseline (US Healthcare)

This document captures **frontend-level** controls that support US healthcare deployments.
It is not legal advice and is not a substitute for a formal HIPAA/HITECH assessment.

## Scope

- Repository: `health-cloud-hub`
- Layer: Browser frontend + deployment headers
- Out of scope: BAA contracts, cloud tenancy controls, SOC 2 evidence, incident response operations, and policy/legal approvals.

## Implemented Technical Controls

### 1) Authentication & Session Hardening

- Supabase URL/key are required from environment variables; no development fallback credentials in source.
- Session storage uses `sessionStorage` to reduce persistence of sensitive auth artifacts across browser restarts.
- Route-level guard blocks unauthenticated access to `/dashboard`.

### 2) Secure-by-default Input & Account UX

- Sign-up password policy enforces 12+ chars with uppercase, lowercase, number, and symbol.
- Generic account-creation error messaging reduces leakage of backend validation details.

### 3) Browser Security Headers (Vercel)

- HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and baseline `Content-Security-Policy` are configured.

## Regulatory Mapping (High-Level)

| Regulatory expectation | Implemented in this repo | Notes |
| --- | --- | --- |
| HIPAA Security Rule - Access control (45 CFR §164.312(a)) | Partial | Auth + protected routes present; enforce RLS and role checks in Supabase DB policies.
| HIPAA Security Rule - Transmission security (45 CFR §164.312(e)) | Partial | HTTPS assumed via hosting + HSTS header; verify TLS configuration and cert lifecycle operationally.
| HIPAA Security Rule - Integrity controls (45 CFR §164.312(c)) | Partial | Client-side constraints only; integrity must be enforced server-side and DB-side.
| HIPAA Security Rule - Audit controls (45 CFR §164.312(b)) | Gap | Implement centralized audit logging and immutable retention outside frontend.
| HIPAA Privacy Rule - Minimum necessary | Partial | Role-specific dashboards exist; verify backend field-level access restrictions.
| Breach notification readiness | Gap | Requires organizational incident response and legal workflow.

## Remaining Actions Before Claiming Compliance

1. Execute a formal HIPAA risk analysis and management plan.
2. Verify and enforce Supabase Row Level Security for all PHI tables.
3. Add immutable audit logs for auth, record access, record export, and admin actions.
4. Implement consent management and patient disclosures workflows.
5. Add automated dependency + SAST/DAST scanning in CI.
6. Add disaster recovery drills, backup verification, and retention policy evidence.
7. Validate accessibility (WCAG 2.1 AA) with manual assistive-tech testing.
8. Run production load/performance testing with SLO thresholds.

## Verification Commands (executed locally)

- `npm run lint`
- `npm run build`

