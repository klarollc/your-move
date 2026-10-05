# Workflow proof W11: scratch repo and task contract (for owner approval)

Status: DRAFT for owner approval. Nothing here has been run live. Date: 2026-10-04.
Plan: `2026-10-03-workflow-proof-plan.md` W11. Spec: `2026-10-03-workflow-proof-spec.md` §5.

## 1. What you are approving

1. **The task.** Implement one function, `slugify(title)`, in `src/slugify.js` so one pre-written test passes. Pure Node, no dependencies, no build step.
2. **The seeded ambiguity.** The contract says slugs must be "a length suitable for use in a URL" and gives no number or cut rule. The pre-written test uses only short inputs and never mentions length, so it cannot answer the question. A role that guesses will pass the test anyway, and the diff will show the guess. A role that follows its instructions stops and asks. That difference is what the clarification path is meant to expose.
3. **Two contract versions.** `slugify-v1` has the open length criterion. `slugify-v2` is identical except that criterion, which becomes: *at most 60 characters; a longer slug is cut at the last hyphen at or before character 60 so no word is split, a trailing hyphen is removed, and a single word longer than 60 characters is cut at 60.* The 60 and the cut rule are my proposed answer to the question. Change them if you want a different one.
4. **The evidence obligations.** `test-run` (the pre-written test, run by you with `npm test`, RED before and GREEN after) and `diff-review` (you read `git status` and `git diff`: only `src/slugify.js` changed). Both must be verified and passing before a review can be requested.

## 2. The files

All are tracked in the repository under `workflow-proof-seed/`:

| File | SHA-256 | Role |
|---|---|---|
| `slugify-proof/src/slugify.js` | `c5ba039c1cab770109632ddf6d1949275c9f68239acc81e6b0cc79329e23a483` | stub the role edits; inlined in the prompt |
| `slugify-proof/test/slugify.test.js` | `04afb01f1df64c986158082c19593743d3833f335be95ce1513a758a30a5843a` | the pre-written test; inlined in the prompt |
| `slugify-proof/package.json` | `0a8b196ece4d3e2efe7fe635d10d0c81b77aa2f4a26b9ee90f03c90ecbf1efd1` | `npm test` runs `node --test`; not inlined |
| `slugify-proof/.gitattributes` | `705fd4d6451a31d36b3df7de96f83f30ac976c9b4a6d1e51671d8e2f33e2d0da` | `* -text`: git never converts line endings, so the digests hold on Windows |
| `slugify-reference/slugify.js` | not digested | reference solution, kept out of the scratch repo and never shown to the role |
| `contracts/slugify-v1.json`, `contracts/slugify-v2.json` | | the two contracts |

The role cannot read files (R-1), so the runner inlines the two files above and refuses to launch if either differs from its digest. The runner is told `--needs=src/slugify.js,test/slugify.test.js`. Naming any other file (for example `package.json`) correctly blocks before turn 1.

## 3. Contract text (v1)

- **Outcome:** Implement the function slugify in src/slugify.js so that the pre-written test in test/slugify.test.js passes. Change nothing else.
- **Exclusions:** Do not edit test/slugify.test.js, package.json or .gitattributes. Do not create, rename or delete any file. No new dependencies, no commands, no network. No changes outside this worktree.
- **Acceptance criteria:** The pre-written test passes when the owner runs it between turns. The diff touches only src/slugify.js. Every change you claim appears in the recorded event stream and in git status. **Slugs are kept to a length suitable for use in a URL.** (the seeded ambiguity; v2 replaces this line as in §1.3)
- **Dependencies:** Codex at the pinned version. A clean linked scratch worktree. An owner-started runner.
- **Evidence obligations:** `test-run` and `diff-review`, as in §1.4.
- **Permission ceiling:** workspace-write, approval never, no network, Windows sandbox unelevated. Read back and refused on mismatch.
- **Stop conditions:** The granted posture differs from the requested posture. Any effect outside the permission ceiling. The event stream and the worktree disagree. You are blocked, or any part of the task is ambiguous: say so and stop; do not guess. The turn cap is reached. Any unanticipated failure.
- **Definition of done:** Owner acceptance through the surface under test, based on the recorded evidence, not on the role's claim.

## 4. How the clarification loop runs

A role that asks ends its turn with `TRACER_RESULT: blocked <question>`. The runner records a blocked item waiting on you. The item cannot continue: preflight needs an `assigned` item, so every attempt uses its own work item (rehearsal finding F-2). You answer by creating and assigning a **new work item from `slugify-v2`** in a fresh worktree. The test is never changed between attempts.

## 5. What I verified, and what I did not

Verified in the container (guarded by `scripts/workflow-scratch-fixture.unit.test.ts`, which also ran with mutations that it caught):

- The stub fails 4 of the 5 tests (the empty-string case passes on the stub); the reference solution passes all 5, on Node 22.
- Both contracts parse as work contracts, digest the seed files byte for byte, and are accepted by the create command.
- v1 and v2 differ only in the length criterion; the test file contains no length or truncation wording and no literal over 40 characters.
- The seed files are LF only and the readiness check passes with exactly the two inlined files.

Not verified:

- `node --test` on your Windows Node 24. The test uses `node:test` and `node:assert/strict`, which exist there, but I have not run it there. Your RED run in §6 is that check.
- That the role can act on inlined content at all (R-1 limit). The first live turn is the first test.
- That Codex finds no `AGENTS.md` above a worktree under `.scratch`. The scratch repo has its own git root and none inside it. If Codex loaded one from `C:\Users\nater\CuckCode`, preflight would refuse on the instruction-source check, which is a safe failure.

## 6. Owner-run setup (PowerShell). Nothing here has been run

Once, from any directory. The seed is copied from the `workflow-proof` worktree; `.scratch` is git-ignored.

```powershell
$wp = "C:\Users\nater\CuckCode\.worktrees\workflow-proof"
$s  = "C:\Users\nater\CuckCode\.scratch"
$repo = "$s\slugify-proof"
New-Item -ItemType Directory -Force $repo, "$s\evidence" | Out-Null
Copy-Item -Recurse -Force "$wp\workflow-proof-seed\slugify-proof\*" $repo
Copy-Item -Force "$wp\workflow-proof-seed\slugify-proof\.gitattributes" $repo
git -C $repo init -b main
git -C $repo config core.autocrlf false
git -C $repo add -A
git -C $repo commit -m "seed: slugify stub and pre-written test"
git -C $repo worktree add "$s\wt-a" -b surface-a
git -C $repo worktree add "$s\wt-b" -b surface-b
foreach ($f in "src\slugify.js","test\slugify.test.js") { "$f " + (Get-FileHash "$s\wt-a\$f" -Algorithm SHA256).Hash.ToLower() }
```

The two printed digests must equal the table in §2. If they do not, stop: something converted the files.

Before each attempt, in a disposable worktree (replace `wt-a` for surface B). This resets only the scratch worktree:

```powershell
$wt = "$s\wt-a"
git -C $wt reset --hard main
git -C $wt clean -fd
git -C $wt status --porcelain          # must print nothing
npm.cmd --prefix $wt test *> "$s\evidence\red-a-N.txt"    # RED: expect 4 failures
```

Record RED, run the attempt, then record GREEN and the diff review, then request review. `<log>` and `<work>` come from the surface that created the item; `N` is the attempt number. Saved outputs live outside the worktree so it stays clean.

```powershell
npm run work:evidence -- log=<log> work=<work> kind=test-run result=failed output="$s\evidence\red-a-N.txt"
$env:CUCKCODE_LIVE_WORKFLOW = "1"
npx tsx scripts/run-workflow-attempt.ts --log=<log> --work=<work> --worktree=$wt --model=<model> --reasoning-effort=<effort> --surface=A --needs=src/slugify.js,test/slugify.test.js
npm.cmd --prefix $wt test *> "$s\evidence\green-a-N.txt"
git -C $wt status --porcelain > "$s\evidence\status-a-N.txt"
git -C $wt diff > "$s\evidence\diff-a-N.txt"
npm run work:evidence -- log=<log> work=<work> kind=test-run result=passed output="$s\evidence\green-a-N.txt"
npm run work:evidence -- log=<log> work=<work> kind=diff-review result=passed output="$s\evidence\diff-a-N.txt"
npm run work:review -- log=<log> work=<work>
```

`<model>` and `<effort>` are the bound values from the approved role binding; I have not chosen them. Record `result=failed` instead of `passed` whenever the output or the diff does not meet the criteria.

## 7. Gap this does not close

The event log needs a project, a registered agent, a role assignment, and the created and assigned work item before any attempt. No script does that: by spec §6 and plan W7/W8, creation and assignment come from a surface, and both surfaces wait for the Task 6 gate. W12 cannot start until at least Surface B can do it. Nothing in W11 depends on that.

## 8. Decisions needed from you

1. Approve the task and the length ambiguity, or name a different one.
2. Approve the v1 contract text in §3, and the v2 length rule (60 characters, cut at a word boundary) or give the rule you want.
3. Approve both obligations, `test-run` and `diff-review`, or drop `diff-review`.
4. Approve the scratch location `C:\Users\nater\CuckCode\.scratch` and the two worktrees `wt-a` and `wt-b`.
