# Gemini Notes Workspace Rules

## 1. Git Branching & Production Release Workflow (`test` -> `main`)
- **Default Working Branch (`test`)**: Always ensure the repository in `gemini-notes/` is checked out on the `test` branch before making code or documentation changes.
- **Stage & Push to `test` First**: Commit and push all new features, bug fixes, and updates to `origin/test` first. Build test bundles in `gemini-notes/release/Gemini Notes.app` (`npm run package:mac`).
- **Production Gate (`main` & Desktop App)**: Do NOT merge into `main`, push to `origin/main`, or overwrite `/Users/vincentmoses/Desktop/Gemini Notes.app` unless the user explicitly asks to promote/push to production.
- **Promoting to Production**: When the user approves promoting to production:
  1. Merge `test` into `main` (`git checkout main && git merge test && git push origin main`).
  2. Rebuild and copy the verified bundle to `/Users/vincentmoses/Desktop/Gemini Notes.app` using `ditto --norsrc`.
  3. Switch the working branch back to `test` (`git checkout test`) for subsequent work.

## 2. macOS `.app` Packaging & Code Signing
- Always stage and sign `.app` bundles in `/tmp/Gemini Notes.app` (`xattr -cr` followed by `codesign --force --deep --sign -`) and copy to `release/` or `~/Desktop` using `ditto --norsrc` so Finder/iCloud extended attributes do not invalidate the signature.

## 3. Gemini API & Diagnostics Conventions
- Default to `gemini-3-flash-preview`, parse all `models/<id>` suggestions with `matchAll` on error responses, and fall back to querying `v1beta/models` (`ListModels`) when a model ID returns 404.
- Log all API calls, model fallbacks, and `GN-*` error codes through `src/services/logger.ts`.
