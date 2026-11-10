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

## Live editor acceptance

On 2026-11-09, the packed 0.1.0 release artifact was installed in a disposable n8n 2.46.6 instance and tested against an authorized IAM360 demo account. This was an installed package test, not only a custom development loader.

| Check                       | Result                                                                                                                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node identity and branding  | IAM360 node and official logo rendered in the editor.                                                                                                                                                                                                                                                    |
| OAuth                       | Dynamic registration, exact instance callback, PKCE S256, `fitness offline_access`, and MCP resource binding were observed. Consent and reconnection completed successfully.                                                                                                                             |
| Read operations             | Overview, daily metrics, nutrition, and workouts all completed successfully, including a final run after reconnection.                                                                                                                                                                                   |
| Examples                    | Both shipped JSON examples were imported, assigned the test credential, and executed successfully.                                                                                                                                                                                                       |
| Output                      | Simplified overview returned ten fields. Missing measurements remained `null` in raw rows and mapped metrics.                                                                                                                                                                                            |
| Automatic refresh           | Replacing only the disposable local access token with an invalid test value exercised the 401 refresh path. n8n obtained and persisted a fresh access token and future expiry, then completed all four reads without another sign-in. This was a controlled refresh test, not a wait for natural expiry. |
| Meal create and delete      | One clearly named test meal with supplied nutrition values was created, read back by its returned ID, deleted by that exact ID, and confirmed absent. The supplied values use IAM360's non-estimation write path.                                                                                        |
| Revoked refresh             | After revoking the test refresh token and simulating expired access, the editor reported that the IAM360 credential needed reconnection. No token values appeared in the error.                                                                                                                          |
| Batch and continue on error | Three input items returned two successful metric outputs and one expected invalid-days error. All three outputs preserved their input item links. A credential-free test workflow was exported.                                                                                                          |
| Cleanup                     | The test meal was absent, the final disposable refresh grant was revoked, and the local test credential, database, encryption key, and runtime were removed.                                                                                                                                             |

Clerk's default OAuth access tokens are JWTs. Revoking a refresh token alone does not immediately invalidate an already-issued JWT. The revocation acceptance check therefore tested failure after the local access copy became unusable, followed by a successful reconnect. It does not claim immediate provider JWT revocation. See [Clerk's token revocation documentation](https://clerk.com/docs/reference/backend/oauth-applications/revoke-token).

The separate credential test is implemented as a tools-list request and is covered by automated checks. Live acceptance established OAuth and authenticated node execution; a separate credential-test UI result was not retained.

Repeat these checks for changes to authentication, transport, operation behavior, or the minimum supported n8n version. Use an authorized demo account, keep credentials out of exports, and do not retry ambiguous writes automatically. Registry installation and n8n verification remain post-publication steps.

## Publication and verified-node submission

1. Publish the reviewed source to the public company repository `iam360-ai/n8n-nodes-iam360`, with IAM360 as maintainer.
2. Recheck npm availability for `n8n-nodes-iam360` and use an IAM360-controlled npm publisher. Do not register or publish through an unrelated account.
3. Upload this source and lockfile through the company GitHub account. Keep `node_modules`, `dist`, `.n8n`, tarballs, and all secrets out of Git.
4. Review the live acceptance results above. Confirm that the release source matches the tested code. After npm approval, update any repository-only release status without claiming n8n verification before approval.
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
