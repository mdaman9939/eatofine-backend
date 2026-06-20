# Security remediation — committed database credentials

The Atlas connection credentials were committed to this repo (`.env`, and previously
mirrored in `.env.example`). Treat the leaked password as **compromised**.

## Already done in this change
- `.gitignore` now ignores `.env` / `.env.*` (keeps `.env.example`).
- `.env` untracked via `git rm --cached .env` (local file preserved; next commit removes it from the tree).
- `.env.example` scrubbed to placeholders only.

## You must still do (manual / destructive — not automated here)
1. **Rotate the Atlas password NOW** (Atlas → Database Access → edit user → new password).
   URL-encode special chars (`@` → `%40`) in `MONGO_PASSWORD`.
2. **Set the new secrets in the Render dashboard** env vars (`MONGO_USER`, `MONGO_PASSWORD`,
   `MONGO_HOSTS`, `MONGO_REPLICA_SET`, `MONGO_AUTH_SOURCE`, `JWT_SECRET`). Production must NOT
   read from a committed `.env`.
3. **Commit the untrack + gitignore change.**
4. **Purge `.env` from git history** (the old password is still in commits `c6465ae`, `0d14eac`,
   `c38a4a8`). Use one of:
   ```sh
   # git-filter-repo (preferred)
   git filter-repo --path .env --invert-paths
   # or BFG
   bfg --delete-files .env
   ```
   Then force-push and have all collaborators re-clone. (Rotating the password in step 1 is the
   real mitigation; history purge is cleanup.)
5. Rotate `JWT_SECRET` too if it was ever committed (forces all users to re-login — acceptable).
