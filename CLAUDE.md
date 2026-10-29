# hasannawaz.com — instructions for Claude

Before starting any new task in this project, read these two files in full:

1. **`HANDOFF.md`**: what the project is, where everything lives (repos, hosting, DNS, Cloudflare,
   source files), the current state and open issues, how Hasan works, and what was tried and rejected.
2. **`DESIGN.md`**: the design system: tone of voice, colour, type, layout, components, motion,
   accessibility, and the performance budgets.

Follow them. If the code and these files disagree, say so and ask which is right, then update the file.

## Always
- **Never commit or push unless Hasan says "push".** A push to `main` goes live on hasannawaz.com
  within minutes (Cloudflare Worker `designengineer`). Show changes locally first
  (`python3 scripts/serve.py 5175`) and check them in the browser on desktop and phone widths.
- One task at a time when he sends several.
- Copy rules: first person, plain, no exclamation marks, numerals not words, "7+ years",
  never invent or paraphrase testimonials. Blue `#2563EB` for the highlighted phrase.
- Reels: calm (~1x speed), best parts only, dips not ghosting crossfades, no zooms.
  Tools and recipes are in `HANDOFF.md` and `scripts/reel/`.
- Before any Cloudflare step, check the account switcher shows Hasan's own account.
- Don't kill the process on port 5173 (another of his projects).

## Keep the docs current
When a task changes something these files describe (a section, a component, a token, hosting,
an open issue), update `HANDOFF.md` and/or `DESIGN.md` in the same change. Doc files are kept
out of the published site by `.assetsignore`.
