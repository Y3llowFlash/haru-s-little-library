# Security

## Reporting a vulnerability

Please do not open a public issue containing exploit details or credentials.
Contact the repository owner privately through their GitHub profile instead.

## Secrets

- Never commit `.env` files, access tokens, API keys, or service credentials.
- Keep production secrets in Vercel Environment Variables.
- Variables prefixed with `VITE_` are bundled into the browser and must be
  treated as public.
- Secret-backed API calls must run in a server-side function or API route; the
  browser should call that endpoint instead of the third-party API directly.
- If a credential is committed accidentally, revoke and rotate it immediately.
  Removing it from the latest commit is not sufficient because Git history may
  retain it.
