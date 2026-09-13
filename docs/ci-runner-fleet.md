# SK7 CI runner fleet

This is an execution-capacity layer only. It does not change product, deployment,
Model V2, API, database, auth, or scene semantics.

## Cloud runner switch

Required GitHub Actions jobs keep their existing names and workflow structure.
Their runner is selected with the repository variable `SK7_CLOUD_RUNNER`.

The workflow accepts exactly one external managed-runner label:

```text
blacksmith-4vcpu-ubuntu-2404
```

Any missing or different value falls back to:

```text
ubuntu-latest
```

This makes the migration reversible without another code change.

### Enable Blacksmith

1. Install/authorize Blacksmith for `AI-HealthCare-05/AH_05_07`.
2. In GitHub repository settings, create Actions repository variable:
   `SK7_CLOUD_RUNNER=blacksmith-4vcpu-ubuntu-2404`.
3. Trigger or update a PR and confirm the existing CI and Browser E2E checks run
   successfully on the managed runner.
4. Rollback is immediate: delete the variable or change it away from the exact
   allow-listed value. Workflows fall back to `ubuntu-latest`.

Do not place Blacksmith credentials in the repository.

## Trusted local runner fleet

The local machines are intentionally excluded from `pull_request`, `push`, and
scheduled triggers. `.github/workflows/trusted-local-runners.yml` is
`workflow_dispatch` only.

This is a security boundary for the public repository: untrusted fork PR code
must never be scheduled onto a persistent developer machine.

Both runners should be registered at repository scope and hold no production
secrets.

### Windows laptop

Use WSL2 Ubuntu 24.04 as the runner OS rather than a native Windows runner.

Required:
- WSL2 Ubuntu 24.04
- Docker available inside WSL2
- Git
- GitHub Actions runner for Linux x64
- custom runner label: `sk7-linux`
- dedicated local runner account/workspace
- no SSH/private cloud/application production credentials in the runner account

Register from:

`Settings -> Actions -> Runners -> New self-hosted runner -> Linux -> x64`

Use the generated one-time token and add the custom label during configuration.
A representative configuration shape is:

```bash
./config.sh \
  --url https://github.com/AI-HealthCare-05/AH_05_07 \
  --token <ONE_TIME_TOKEN_FROM_GITHUB> \
  --name sk7-win-wsl \
  --labels sk7-linux \
  --unattended
```

Do not commit or save the one-time token.

### Mac laptop

Register the native macOS runner with custom label `sk7-macos`.

Register from:

`Settings -> Actions -> Runners -> New self-hosted runner -> macOS`

Representative configuration shape:

```bash
./config.sh \
  --url https://github.com/AI-HealthCare-05/AH_05_07 \
  --token <ONE_TIME_TOKEN_FROM_GITHUB> \
  --name sk7-mac \
  --labels sk7-macos \
  --unattended
```

The manual macOS job intentionally starts with native build + Chromium review
smoke. WebKit-specific qualification can be added separately after the fleet is
stable rather than broadening this infrastructure change.

## Operating rule

- PR merge gates: managed ephemeral cloud runner when enabled; GitHub-hosted
  fallback otherwise.
- Windows WSL2 and Mac: trusted manual verification only.
- Merge, deployment, and real-device acceptance remain separate actions.
- Do not change local runners into public-PR runners.
