# Dispensia Production Foundation

## Architecture

- Next.js App Router serves the UI and versioned route handlers.
- Supabase Postgres is the production persistence layer.
- Supabase Auth will provide staff identity; server routes must verify the session before mutations.
- The API response shape is explicit and excludes secrets or internal auth fields.
- The current demo data remains available until Supabase environment variables are configured.

## Security boundaries

- Client-side forms improve usability but never replace server validation.
- Route handlers validate query parameters and request bodies before access to data.
- Inventory and dispensing mutations require an authenticated staff role in the Supabase-backed implementation.
- Audit events record dispensing, stock adjustments, safety overrides, and role changes.

## Delivery sequence

1. Route-based frontend and staff sign-in experience.
2. Supabase schema, row-level security, and typed data access.
3. Authenticated API routes for inventory, patients, prescriptions, and audit events.
4. Role permissions for admin, pharmacist, technician, and auditor.
5. Vercel environment configuration and deployment checks.
