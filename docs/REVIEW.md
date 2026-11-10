# Review and release notes

## Release readiness

The package is a release candidate for `n8n-nodes-iam360` version `0.1.0`. Its company source repository is `iam360-ai/n8n-nodes-iam360`. npm publication and n8n verification are separate steps. A public repository alone does not make the node available in n8n Cloud.

## Implemented

- Six bounded, typed operations over IAM360's official MCP server.
- n8n-managed OAuth with automatic discovery, dynamic registration, resource binding, and offline access.
- A credential test that lists tools without fetching fitness data.
- Per-item expressions, item linking, and the continue-on-error path.
- Simplified, raw, and field-selected overview output, so workflows and agents can request only the sections they need.
- Validation before writes, explicit nutrition values, and no automatic write retries.
- HTTP, JSON-RPC, MCP tool, and application error handling.
- Preservation of missing metric values and original response fields.
- Branded icon, MIT license, setup instructions, and two inactive read-only workflows.
- No external runtime dependencies, filesystem access, environment access, telemetry, or embedded credentials in the node.

## Local validation

The package was built on Node.js 24.22.1 with pnpm 12.16.1, `@n8n/node-cli` 0.55.5, and `n8n-workflow` 2.16.0. The OAuth credential shape was checked against the official source for n8n 2.46.6.

Minimum supported host version: **n8n 2.46.6**. The `n8n-workflow` peer dependency is `*` because the official `@n8n/community-nodes/valid-peer-dependencies` lint rule requires that exact value. It does not claim compatibility with older n8n runtimes. The development dependency is pinned separately to 2.16.0.

- `pnpm install --frozen-lockfile`: passed. Unneeded dependency install scripts are explicitly denied in `pnpm-workspace.yaml`.
- `pnpm lint`: the official community node lint rules passed.
- `pnpm test`: TypeScript build and 15 focused behavior tests passed.
- Package contents: built node, built credential, logo, license, docs, and sample workflows. No account secrets or credentials are included.

These are local automated checks with mocked authenticated HTTP. They do not prove that a complete live n8n OAuth flow or deployment has been tested.

## Required live acceptance checks before release

Run these in a disposable n8n instance with an authorized IAM360 demo account. Do not include passwords or tokens in screenshots, the repository, or workflow exports.

1. Start the development node with `pnpm dev` on n8n 2.46.6 or later and confirm the IAM360 node and logo load in the editor.
2. Create the IAM360 OAuth2 credential. Confirm dynamic registration uses that instance's exact callback, authorization uses PKCE S256 and `fitness offline_access`, and the protected resource is `https://app.iam360.ai/api/mcp`.
3. Complete consent and confirm the credential test succeeds by listing tools.
4. Run both example workflows and the nutrition/workout reads. Check an account with missing wearable measurements retains `null` values.
5. Allow the access token to expire, or use an isolated test credential with an expired access token. Confirm refresh works without an extra sign-in and retains the MCP resource binding.
6. With explicit authorization to change the demo account, create one clearly named test meal with known nutrition values. Confirm no AI estimator is invoked. Read the meal back and delete that exact returned ID. Confirm it is removed. Do not retry ambiguous writes automatically.
7. Revoke the demo connection, confirm subsequent access fails, and reconnect. Confirm token and client-secret values are absent from captured errors.
8. Test an input batch and **On Error > Continue** in the actual editor, then export the test workflow without credentials.

## Publication and verified-node submission

1. Publish the reviewed source to the public company repository `iam360-ai/n8n-nodes-iam360`, with IAM360 as maintainer.
2. Recheck npm availability for `n8n-nodes-iam360` and use an IAM360-controlled npm publisher. Do not register or publish through an unrelated account.
3. Commit this source and lockfile. Keep `node_modules`, `dist`, `.n8n`, tarballs, and all secrets out of Git.
4. Finish the live checks above. Remove the unpublished-candidate installation notice from the README only when the release is actually public.
5. Configure the repository's `npm` environment. For an existing npm package, add a trusted publisher for owner `iam360-ai`, repository `n8n-nodes-iam360`, workflow `publish.yml`, environment `npm`, with direct publishing allowed. Leave `NPM_TOKEN` unset when using trusted publishing. For the first release, create an IAM360-controlled granular token with **Read and write (stage only)** permission and **Bypass 2FA disabled**, then save it as the `NPM_TOKEN` environment secret. The default workflow mode creates a staged package, including new package names. Approve the stage in the npm website using the publisher account's security key or passkey. Configure trusted publishing after staging creates the package settings, then revoke and remove the bootstrap token. The workflow is manually dispatched, validates its repository/version/tag, and publishes with provenance. Pushing source does not publish it.
6. In GitHub, create a matching version tag, such as `v0.1.0`, on the reviewed commit. Open **Actions > Publish > Run workflow**, select that tag, enter the same tag in the tag field and `publish-iam360` in the confirmation field. Keep mode **stage** for a browser-approved release; select **publish** only when direct trusted publishing is configured. Run only after ownership, release contents, and live checks are verified. The workflow rejects a branch ref or mismatched tag so the published code matches the provenance source. Both workflows run lint and tests. Do not publish locally for the verified-node submission. Direct publication waits up to ten minutes for registry availability. A staged version does not become installable until approved on npm. If that check times out after an accepted upload, inspect npm before retrying.
7. Check the npm page shows provenance and the exact public source repository. Confirm installation from npm in a clean n8n instance.
8. In IAM360's n8n Creator Portal account, submit the npm package URL and complete the review details. Include the demo verification method privately when requested. Do not put demo credentials in a public README or repository.
9. Wait for n8n's decision before calling this a verified integration or claiming it is available in n8n Cloud.

The verified community node route is separate from the request to list IAM360's hosted MCP server in n8n's curated MCP directory. One does not imply approval of the other.

## Primary references

- [n8n verification guidelines](https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines/)
- [Submit a community node](https://docs.n8n.io/connect/create-nodes/deploy-your-node/submit-community-nodes/)
- [Programmatic node tutorial](https://docs.n8n.io/connect/create-nodes/build-your-node/tutorial-build-a-programmatic-style-node/)
- [Official n8n node starter](https://github.com/n8n-io/n8n-nodes-starter)
- [IAM360 MCP documentation](https://app.iam360.ai/docs/mcp)

- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [pnpm publish and provenance](https://pnpm.io/cli/publish)

- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
