import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

export const MCP_URL = 'https://app.iam360.ai/api/mcp';
export const PROTOCOL_VERSION = '2026-07-28';
export const CREDENTIAL_NAME = 'iam360OAuth2Api';

export function object(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function safeError(error: unknown): string {
	const text =
		error instanceof Error
			? error.message
			: typeof error === 'string'
				? error
				: 'IAM360 request failed';
	return text
		.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
		.replace(
			/((?:access_token|refresh_token|client_secret|authorization)["']?\s*[:=]\s*["']?)[^\s"',;&}]+/gi,
			'$1[redacted]',
		)
		.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]')
		.slice(0, 1000);
}

export function requestEnvelope(
	method: 'tools/call' | 'tools/list',
	name?: string,
	args?: IDataObject,
): IDataObject {
	return {
		jsonrpc: '2.0',
		id: 1,
		method,
		params: {
			...(name ? { name, arguments: args ?? {} } : {}),
			_meta: {
				'io.modelcontextprotocol/protocolVersion': PROTOCOL_VERSION,
				'io.modelcontextprotocol/clientCapabilities': {},
			},
		},
	};
}

export function parseToolResult(response: unknown): IDataObject {
	if (!object(response) || response.jsonrpc !== '2.0') {
		throw new Error(
			'IAM360 returned an invalid JSON-RPC response. Reconnect or contact IAM360 support.',
		);
	}
	if (object(response.error)) {
		throw new Error(
			safeError(
				`IAM360 protocol error: ${String(response.error.message ?? response.error.code ?? 'Unknown error')}`,
			),
		);
	}
	const result = response.result;
	if (!object(result)) throw new Error('IAM360 returned no result.');
	const content = Array.isArray(result.content) ? result.content : [];
	const text = content
		.filter(object)
		.filter((part) => part.type === 'text' && typeof part.text === 'string')
		.map((part) => part.text as string)
		.join('\n');
	if (result.isError === true)
		throw new Error(safeError(text || 'IAM360 could not complete this operation.'));
	let data: unknown = result.structuredContent;
	if (!object(data)) {
		try {
			data = JSON.parse(text);
		} catch {
			data = undefined;
		}
	}
	if (!object(data))
		throw new Error('IAM360 returned an unreadable result. No automatic retry was attempted.');
	if (data.ok === false || typeof data.error === 'string' || object(data.error)) {
		const message =
			typeof data.error === 'string'
				? data.error
				: object(data.error) && typeof data.error.message === 'string'
					? data.error.message
					: 'IAM360 could not complete this operation.';
		throw new Error(safeError(message));
	}
	return data as IDataObject;
}

export function addNamedMetrics(data: IDataObject): IDataObject {
	if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) return data;
	const columns = data.columns;
	if (
		!columns.every((column) => typeof column === 'string') ||
		new Set(columns).size !== columns.length
	) {
		throw new Error('IAM360 returned invalid metric columns.');
	}
	const metrics = data.rows.map((row) => {
		if (!Array.isArray(row) || row.length !== columns.length)
			throw new Error('IAM360 returned an invalid metric row.');
		const item: IDataObject = {};
		for (let index = 0; index < columns.length; index++) {
			const key = columns[index] as string;
			if (key === '__proto__' || key === 'constructor' || key === 'prototype')
				throw new Error('IAM360 returned an invalid metric column.');
			item[key] = row[index];
		}
		return item;
	});
	return { ...data, metrics };
}

export const OVERVIEW_FIELDS = [
	'activeChallenges',
	'localTime',
	'nutrition',
	'plannedWorkout',
	'recentDates',
	'recentEvents',
	'recentMeals',
	'recentWorkouts',
	'timezone',
	'timezoneDefaulted',
	'today',
	'unavailableSections',
	'wearable',
	'weekday',
] as const;

const SIMPLIFIED_OVERVIEW_FIELDS = [
	'today',
	'timezone',
	'timezoneDefaulted',
	'wearable',
	'nutrition',
	'activeChallenges',
	'recentMeals',
	'recentWorkouts',
	'plannedWorkout',
	'unavailableSections',
];

export function formatOverview(
	data: IDataObject,
	output: unknown,
	selectedFields: unknown,
): IDataObject {
	if (output === 'raw') return data;
	const fields = output === 'simplified' ? SIMPLIFIED_OVERVIEW_FIELDS : selectedFields;
	if (
		(output !== 'simplified' && output !== 'selected') ||
		!Array.isArray(fields) ||
		fields.some((field) => !OVERVIEW_FIELDS.includes(field))
	) {
		throw new Error('Choose a valid Overview output and fields.');
	}
	return Object.fromEntries(
		fields
			.filter((field) => Object.prototype.hasOwnProperty.call(data, field))
			.map((field) => [field, data[field]]),
	);
}

export async function callTool(
	this: IExecuteFunctions,
	name: string,
	args: IDataObject,
): Promise<IDataObject> {
	const response: unknown = await this.helpers.httpRequestWithAuthentication.call(
		this,
		CREDENTIAL_NAME,
		{
			method: 'POST',
			url: MCP_URL,
			headers: {
				Accept: 'application/json, text/event-stream',
				'Content-Type': 'application/json',
				'MCP-Protocol-Version': PROTOCOL_VERSION,
				'Mcp-Method': 'tools/call',
				'Mcp-Name': name,
			},
			body: requestEnvelope('tools/call', name, args),
			json: true,
			timeout: 60000,
		},
	);
	const data = parseToolResult(response);
	return name === 'get_daily_metrics' ? addNamedMetrics(data) : data;
}
