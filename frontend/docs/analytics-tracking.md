# Analytics Tracking Spec (GA4 via Cloudflare Zaraz)

## Overview
- Property: GA4 (configured in Cloudflare Zaraz tool)
- Domain scope: `beomseo.in`, `www.beomseo.in`
- Environment scope: production only
- Consent mode in this phase: always on
- Identity policy: no `user_id`, no PII, role-only context

## Ownership
- Frontend instrumentation owner: Frontend team
- GA4/Zaraz configuration owner: Infra/ops owner for `beomseo.in`
- Data QA owner: Product/analytics owner

## Event Catalog

| Event | Source | Parameters | Notes |
|---|---|---|---|
| `page_view` | Cloudflare Zaraz SPA support | GA4 defaults | No custom code path required for SPA page views |
| `login` | `AuthContext.login` success | `user_role`, `page_path` | Marked as GA4 key event |
| `login_failed` | `AuthContext.login` failure | `error_type`, `page_path` | Friction diagnostics |
| `sign_up` | `AuthContext.register` success | `user_role`, `page_path` | Marked as GA4 key event |
| `sign_up_failed` | `AuthContext.register` failure | `error_type`, `page_path` | Friction diagnostics |
| `post_created` | create API success | `board_type`, `user_role`, `approval_status`, `page_path` | Marked as GA4 key event |
| `post_create_failed` | create API non-mock failure | `board_type`, `user_role`, `error_type`, `page_path` | Reliability diagnostics |

## Parameter Definitions
- `board_type`: one of `notice`, `free_board`, `club_recruit`, `subject_change`, `petition`, `survey`, `vote`, `lost_found`, `gomsol_market`
- `user_role`: role string when available from response context (e.g., `student`, `admin`, `student_council`)
- `approval_status`: approval or status-style value from API response (`approved`, `pending`, `open`, `closed`, etc.)
- `error_type`: normalized category from runtime error:
  - `validation_error`
  - `auth_error`
  - `network_error`
  - `server_error`
  - `unknown_error`
- `page_path`: current path + query (set automatically by analytics wrapper)

## Key Event Rationale
- `sign_up`: account acquisition completion
- `login`: session re-entry and ongoing usage funnel anchor
- `post_created`: core content contribution across community modules

## Privacy Guardrails
- Blocked keys (never sent): `nickname`, `password`, `email`, `token`, `refresh_token`, `access_token`
- Payloads are sanitized before dispatch to `window.zaraz.track`
- Analytics dispatch is disabled on non-production hosts and non-production builds

## Validation Checklist
1. SPA page navigation emits one `page_view` per route change in GA4 DebugView.
2. Successful/failed login emits `login`/`login_failed`.
3. Successful/failed signup emits `sign_up`/`sign_up_failed`.
4. Each board create success emits `post_created` with correct `board_type`.
5. Create non-mock failure emits `post_create_failed`.
6. No blocked key names appear in outbound Zaraz payloads.
7. Localhost does not emit analytics events.

## Change Log
- 2026-02-18: Initial GA4+Zaraz instrumentation added for auth + create conversions with production-only gating.
