# Authentication and RBAC Architecture

## Boundaries

The browser holds a short-lived display session only. The Worker is the
authority for identity, token validity, and every data-changing permission.
The browser router uses the same route-grant data only to avoid showing routes
that the signed-in user cannot open; it is not a security boundary.

```
Login UI -> Auth session coordinator -> API token client -> Worker identity / policy
                 |                         |
                 v                         v
            State + Router            rotating refresh token
```

## Session Rules

1. `Auth` is the only module that changes the browser user session.
2. `ApiHttp` owns access and refresh tokens, but never calls remote logout from
   its local-cleanup path. This prevents recursive logout loops.
3. Mock mode never starts a live API login. Live mode replaces a provisional
   session only after the API login succeeds.
4. A failed background request is reported as a sync failure. Only an explicit
   invalid/expired refresh session ends an authenticated live session.
5. Logout invalidates the local session immediately, then makes one best-effort
   remote revocation request without re-entering `Auth.logout()`.

## Authorization Rules

1. `access-policy.js` normalizes and matches all browser routes, including
   parameterized paths such as `/projects/:id`.
2. The router redirects denied navigation to the role's permitted home route,
   not an arbitrary dashboard destination.
3. Worker handlers enforce the corresponding operation permissions. New API
   write endpoints must add server-side authorization before they are exposed
   in the UI.
4. Persona seed definitions in `js/services/auth.js` and
   `worker/src/routes/auth.js` must be updated together until they are moved to
   a shared identity source.

## Future Production Shape

Move users, roles, grants, and role-to-operation mappings into D1 tables;
issue a JWT containing a policy version and user id only; resolve permissions
on the Worker for each sensitive operation. The client should request `/auth/me`
after refresh and cache that response for display and navigation only.
