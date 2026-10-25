# Working on this project

- Keep code minimal, simple and self-explanatory. Clear names over comments; comments explain _why_.
- Follow the code style in `prettier.config.js` (2 spaces, single quotes, semicolons, 80 columns).
  Format only the files you change (`npx prettier --write <file>`); older files are brought in
  line when they're next touched, never all at once.
- Tests must stay easy to read: test names are plain sentences describing behaviour.
- Whenever a feature is added, removed or changed, run the tests related to it
  (`tests/<name>.test.ts` covers `src/**/<name>.ts`). Add or update tests for the change.
  Before finishing, run `npm run check` (types, formatting and all tests).
- Never commit; leave changes for the user to review.
