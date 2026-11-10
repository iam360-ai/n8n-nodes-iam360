# IAM360 for n8n

![IAM360](https://app.iam360.ai/brand/iam360-agent-icon.png)

Bring your IAM360 fitness records, wearable insights, workouts, and nutrition into n8n workflows.

**Start by creating an account at [app.iam360.ai](https://app.iam360.ai).** Connect your supported wearable and log the information you want your workflows to use.

This is a community node release candidate for `n8n-nodes-iam360`. It has not been verified or approved by n8n. npm installation will be available after its first public release.

## Operations

| Resource     | Operation | What it does                                              |
| ------------ | --------- | --------------------------------------------------------- |
| Overview     | Get       | Get your IAM360 account's fitness overview.               |
| Daily Metric | Get       | Get 1 to 90 days of available wearable metrics.           |
| Nutrition    | Get       | Get meals and nutrition for a date, or today by default.  |
| Workout      | Get       | Get workouts for a date, or the current month by default. |
| Meal         | Create    | Log a meal using calories and protein that you supply.    |
| Meal         | Delete    | Delete a specific meal using its IAM360 meal ID.          |

The node processes each incoming item and returns one corresponding output item. Item linking is preserved, so downstream expressions can reference the input that produced a result. Returned records depend on the data available in your connected IAM360 account.

## Requirements and installation

- An IAM360 account at [app.iam360.ai](https://app.iam360.ai).
- n8n 2.46.6 or newer, with OAuth dynamic client registration support.
- Node.js 24 or newer for self-hosted installation and local development of this package.

For local development, use `pnpm install --frozen-lockfile`, then `pnpm dev`. Follow the development URL printed by the official n8n node CLI. This creates a local development instance. It does not publish the package.

After the package is published, a self-hosted n8n owner can install `n8n-nodes-iam360` from **Settings > Community Nodes**. Availability in n8n Cloud depends on n8n approving the package. Neither npm publication nor n8n approval has happened yet.

## Connect your IAM360 account

1. Add an **IAM360** node to a workflow.
2. Create an **IAM360 OAuth2 API** credential.
3. Select **Connect my account**, then sign in to the intended IAM360 account.
4. Read the permissions on IAM360's consent page and authorize the connection.
5. Save the credential and run **Overview > Get** to read your account's data.

n8n discovers IAM360's OAuth server and handles OAuth setup for its own callback URL. You do not need to copy a client secret from a different integration. Each n8n instance must use its own registered callback. On self-hosted n8n, configure the correct public HTTPS URL before connecting so the callback URL is reachable.

The credential requests `fitness offline_access`, bound to `https://app.iam360.ai/api/mcp`. The fitness permission permits reading, adding, editing, and deleting the connected account's fitness data. Offline access lets n8n refresh the connection for unattended workflows. n8n manages the OAuth tokens in its credential store. The credential's connection test lists available tools and does not read fitness records.

You can review or revoke connected agents in IAM360's account settings. Deleting a credential in n8n removes the local credential; revoke the connection in IAM360 as well when you want to stop the remote authorization.

## Use the output

- **Overview:** choose **Simplified** for the ten main fields, **Raw** for all fields, or **Selected Fields** to limit what downstream workflow steps and AI agents receive. IDs within selected record sections are preserved.
- **Nutrition and workouts:** enter dates as `YYYY-MM-DD`. An omitted date uses IAM360's account timezone, not the n8n host's timezone.
- **Daily metrics:** the node preserves IAM360's original `columns` and `rows`, and adds a `metrics` array with named fields for easier mapping. Missing measurements remain `null`. A missing value is not zero.
- **Create meal:** enter actual calories and protein. Both are required so this operation does not invoke IAM360's AI nutrition estimator. Zero means a known zero value. Omit optional carbohydrates or fat when unknown.
- **Delete meal:** use the UUID returned by IAM360 when you create a meal or get nutrition. Deletion affects the connected account. Check the ID before running the node.
- **Duplicate meals:** leave **Allow Duplicate** off for ordinary logging. Turn it on only when you intend to log another matching meal.

The node exposes these six operations only. It does not run arbitrary tool names, fetch an arbitrary server URL, or silently estimate nutrition.

## Examples

Import either JSON workflow from the `examples` directory into n8n, then select your IAM360 credential:

- `get-fitness-overview.json`: manually retrieve your account overview.
- `get-wearable-metrics.json`: manually retrieve the last 14 days of metrics.

Both examples start inactive, contain no credentials, and only read data. They do not email, upload, or otherwise forward your fitness records. You can add your own destination after reviewing the output.

## Errors and retries

HTTP failures, MCP errors, tool failures, and invalid results stop the node by default. n8n's **On Error** setting can return an error item and continue with later input items. Error messages are sanitized to remove common OAuth token formats.

This package does not automatically retry failed requests. A connection failure during meal creation or deletion can happen after IAM360 has already applied the operation. Before repeating a write, check the account's nutrition records. Keep n8n's **Retry On Fail** disabled for writes unless your workflow explicitly prevents duplicates. n8n may refresh an expired OAuth token through its standard credential handling.

## Privacy and access

Requests go to IAM360's MCP endpoint over HTTPS. The node has no runtime dependencies beyond n8n, does not read files or environment variables, and does not send analytics. n8n workflows and saved execution history can contain personal fitness data. Configure execution retention and access controls for your use case, and connect only destinations you intend to receive that data.

IAM360 is a fitness and wellness product. This package makes no medical or HIPAA compliance claim.

## Development

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm test
```

`pnpm test` builds with the official `@n8n/node-cli` and runs behavioral tests using Node's test runner. No live IAM360 account, token, or production write is used by these tests. See [review and release notes](docs/REVIEW.md) for validation results and the remaining live checks.

## Links and support

- [Create an IAM360 account](https://app.iam360.ai)
- [IAM360 website](https://www.iam360.ai)
- [MCP documentation](https://app.iam360.ai/docs/mcp)
- [Connection guide](https://app.iam360.ai/docs/mcp/connect)
- Support: [support@iam360.ai](mailto:support@iam360.ai)

## License

[MIT](LICENSE). The IAM360 name and logo identify the service and are not an endorsement by n8n.
