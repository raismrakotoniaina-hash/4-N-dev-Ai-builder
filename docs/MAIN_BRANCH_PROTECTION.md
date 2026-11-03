# Main branch protection

Apply this rule to the exact branch name `main`.

- Require a pull request before merging.
- Require at least one approval if another maintainer is available; otherwise keep owner self-approval as a conscious exception.
- Require all conversations to be resolved.
- Require the status checks `AI Builder Build / build-and-test` and `Builder CI / build-and-test`.
- Require branches to be up to date before merging.
- Block force pushes and branch deletion.
- Include administrators in enforcement.

The GitHub connection used for repository changes in this workflow does not have repository-administration write access. A repository owner must apply the rule in Settings → Branches or Rulesets, then verify that the `main` branch endpoint reports `protected: true`.

Do not enable auto-merge for audit-remediation PRs until all checks are green and the database/mobile release gates are understood.
