const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Iam360 } = require('../dist/nodes/Iam360/Iam360.node.js');
const { Iam360OAuth2Api } = require('../dist/credentials/Iam360OAuth2Api.credentials.js');
const { buildCall } = require('../dist/nodes/Iam360/operations.js');
const {
	addNamedMetrics,
	callTool,
	formatOverview,
	parseToolResult,
	requestEnvelope,
	safeError,
} = require('../dist/nodes/Iam360/transport.js');
const read = (values) => (name, fallback) => values[name] ?? fallback;
const result = (data) => ({
	jsonrpc: '2.0',
	id: 1,
	result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
});

test('read operations map only to the intended IAM360 tools', () => {
	assert.deepEqual(buildCall('overview', 'get', read({})), { name: 'get_overview', args: {} });
	assert.deepEqual(buildCall('metrics', 'get', read({ days: 90 })), {
		name: 'get_daily_metrics',
		args: { days: 90 },
	});
	assert.deepEqual(buildCall('nutrition', 'get', read({ date: '2024-02-29' })), {
		name: 'get_nutrition',
		args: { date: '2024-02-29' },
	});
	assert.deepEqual(buildCall('workout', 'get', read({})), { name: 'get_workouts', args: {} });
	assert.throws(() => buildCall('arbitrary', 'get', read({})), /Unsupported/);
});
test('calendar dates and day bounds are validated before any request', () => {
	for (const date of ['2026-02-29', '2026-13-01', 'Nov 8', '2026-11-08T00:00:00Z'])
		assert.throws(() => buildCall('nutrition', 'get', read({ date })), /Date/);
	for (const days of [0, 91, 1.5, NaN, Infinity, '14'])
		assert.throws(() => buildCall('metrics', 'get', read({ days })), /Days/);
});
test('meal writes require explicit nutrition and never fall through to paid estimation', () => {
	assert.throws(() => buildCall('meal', 'create', read({ description: 'Meal' })), /Calories/);
	assert.throws(
		() => buildCall('meal', 'create', read({ description: 'Meal', calories: 100 })),
		/Protein/,
	);
	assert.deepEqual(
		buildCall('meal', 'create', read({ description: '  Meal  ', calories: 100, protein: 0 })),
		{ name: 'log_meal', args: { description: 'Meal', calories: 100, protein: 0 } },
	);
});
test('optional macros stay absent when unknown; zeros and false are retained', () => {
	const call = buildCall(
		'meal',
		'create',
		read({
			description: 'Meal',
			calories: 0,
			protein: 0,
			additionalFields: {
				carbs: 0,
				fat: 0,
				allowDuplicate: false,
				mealDate: '2026-11-08',
				ignored: 'never forwarded',
			},
		}),
	);
	assert.deepEqual(call.args, {
		description: 'Meal',
		calories: 0,
		protein: 0,
		carbs: 0,
		fat: 0,
		allowDuplicate: false,
		mealDate: '2026-11-08',
	});
	assert.throws(
		() => buildCall('meal', 'create', read({ description: 'M', calories: 100, protein: 0 })),
		/Description/,
	);
});
test('only a supplied valid meal UUID is sent for deletion', () => {
	const mealId = 'b4b2e813-c7a6-40a5-930d-abfabf31ae6a';
	assert.deepEqual(buildCall('meal', 'delete', read({ mealId })), {
		name: 'delete_meal',
		args: { mealId },
	});
	assert.throws(() => buildCall('meal', 'delete', read({ mealId: '../someone-else' })), /Meal ID/);
});
test('modern protocol metadata is included on discovery and execution', () => {
	for (const method of ['tools/list', 'tools/call']) {
		const envelope = requestEnvelope(
			method,
			method === 'tools/call' ? 'get_overview' : undefined,
			{},
		);
		assert.equal(envelope.params._meta['io.modelcontextprotocol/protocolVersion'], '2026-07-28');
		assert.deepEqual(envelope.params._meta['io.modelcontextprotocol/clientCapabilities'], {});
	}
});
test('normal and structured results preserve unknown and null data', () => {
	const data = { totals: { protein: null }, note: '<stored_data>user text</stored_data>' };
	assert.deepEqual(parseToolResult(result(data)), data);
	assert.deepEqual(parseToolResult({ jsonrpc: '2.0', result: { structuredContent: data } }), data);
});
test('all error layers fail instead of returning misleading successful data', () => {
	assert.throws(
		() => parseToolResult({ jsonrpc: '2.0', error: { code: -32602, message: 'Bad arguments' } }),
		/Bad arguments/,
	);
	assert.throws(
		() =>
			parseToolResult({
				jsonrpc: '2.0',
				result: { isError: true, content: [{ type: 'text', text: 'Not allowed' }] },
			}),
		/Not allowed/,
	);
	assert.throws(
		() => parseToolResult(result({ ok: false, error: 'Write failed' })),
		/Write failed/,
	);
	assert.throws(
		() => parseToolResult(result({ error: 'Nutrition unavailable', meals: [] })),
		/Nutrition unavailable/,
	);
	assert.throws(
		() => parseToolResult(result({ error: { message: 'Nested failure' } })),
		/Nested failure/,
	);
	assert.throws(
		() =>
			parseToolResult({
				jsonrpc: '2.0',
				result: { content: [{ type: 'text', text: 'not JSON' }] },
			}),
		/unreadable/,
	);
});
test('named metrics preserve raw rows and missing values', () => {
	const input = { columns: ['date', 'recovery'], rows: [['2026-11-08', null]] };
	assert.deepEqual(addNamedMetrics(input), {
		...input,
		metrics: [{ date: '2026-11-08', recovery: null }],
	});
	assert.throws(
		() => addNamedMetrics({ columns: ['date'], rows: [['2026-11-08', 1]] }),
		/invalid metric row/,
	);
	assert.throws(
		() => addNamedMetrics({ columns: ['__proto__'], rows: [[{ polluted: true }]] }),
		/invalid metric column/,
	);
	assert.equal({}.polluted, undefined);
});
test('overview output selection limits data while preserving nulls and record IDs', () => {
	const data = {
		today: '2026-11-09',
		timezone: 'America/Phoenix',
		timezoneDefaulted: false,
		wearable: null,
		nutrition: { totals: { protein: null } },
		activeChallenges: [],
		recentMeals: [{ id: 'meal-1', name: 'Breakfast' }],
		recentWorkouts: [],
		plannedWorkout: null,
		unavailableSections: ['wearable'],
		recentEvents: [{ detail: 'private detail' }],
		newField: 'unrecognized future field',
	};
	const simplified = formatOverview(data, 'simplified');
	assert.equal(Object.keys(simplified).length, 10);
	assert.equal(simplified.wearable, null);
	assert.equal(simplified.recentMeals[0].id, 'meal-1');
	assert.equal('recentEvents' in simplified, false);
	assert.equal('newField' in simplified, false);
	assert.deepEqual(formatOverview(data, 'selected', ['today', 'wearable']), {
		today: '2026-11-09',
		wearable: null,
	});
	assert.equal(formatOverview(data, 'raw'), data);
	assert.throws(() => formatOverview(data, 'selected', ['__proto__']), /valid Overview/);
});
test('credential data is redacted from upstream error text', () => {
	const error = safeError(
		new Error(
			'Bearer abc123 access_token=secret&refresh_token=refresh client_secret="hidden" eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
		),
	);
	for (const secret of ['abc123', '=secret', '=refresh', 'hidden', 'eyJ'])
		assert.equal(error.includes(secret), false);
});
test('HTTP helper sends fixed endpoint with n8n managed credentials and no automatic retry', async () => {
	let count = 0;
	const context = {
		helpers: {
			async httpRequestWithAuthentication(name, options) {
				count++;
				assert.equal(name, 'iam360OAuth2Api');
				assert.equal(options.url, 'https://app.iam360.ai/api/mcp');
				assert.equal(options.headers['Mcp-Name'], 'log_meal');
				assert.equal(options.body.params.arguments.protein, 5);
				throw new Error('Connection timed out after dispatch');
			},
		},
	};
	await assert.rejects(
		callTool.call(context, 'log_meal', { description: 'Meal', calories: 100, protein: 5 }),
		/timed out/,
	);
	assert.equal(count, 1);
});
test('execution preserves per-item expressions and paired items', async () => {
	let count = 0;
	const context = {
		getInputData: () => [{ json: {} }, { json: {} }],
		getNodeParameter: (name, index, fallback) =>
			({ resource: 'nutrition', operation: 'get', date: ['2026-11-07', '2026-11-08'][index] })[
				name
			] ?? fallback,
		helpers: {
			async httpRequestWithAuthentication(_name, options) {
				count++;
				return result({ date: options.body.params.arguments.date });
			},
		},
		continueOnFail: () => false,
		getNode: () => ({
			name: 'IAM360',
			type: 'n8n-nodes-iam360.iam360',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
	};
	const [output] = await new Iam360().execute.call(context);
	assert.equal(count, 2);
	assert.equal(output[0].json.date, '2026-11-07');
	assert.equal(output[1].json.date, '2026-11-08');
	assert.deepEqual(
		output.map((item) => item.pairedItem),
		[{ item: 0 }, { item: 1 }],
	);
});
test('continue on failure returns sanitized per-item errors and proceeds', async () => {
	const context = {
		getInputData: () => [{ json: {} }, { json: {} }],
		getNodeParameter: (name, index, fallback) =>
			({ resource: 'metrics', operation: 'get', days: index ? 14 : 0 })[name] ?? fallback,
		helpers: {
			async httpRequestWithAuthentication() {
				return result({ columns: [], rows: [] });
			},
		},
		continueOnFail: () => true,
	};
	const [output] = await new Iam360().execute.call(context);
	assert.match(output[0].json.error, /Days/);
	assert.deepEqual(output[1].json.metrics, []);
});
test('OAuth discovery is fixed to IAM360 with resource binding and safe credential test', () => {
	const credentials = new Iam360OAuth2Api();
	const defaults = Object.fromEntries(
		credentials.properties.map((property) => [property.name, property.default]),
	);
	assert.equal(defaults.useDynamicClientRegistration, true);
	assert.equal(defaults.serverUrl, 'https://app.iam360.ai/api/mcp');
	assert.equal(defaults.resourceUrl, 'https://app.iam360.ai/api/mcp');
	assert.equal(defaults.scope, 'fitness offline_access');
	assert.equal(credentials.test.request.body.method, 'tools/list');
	assert.equal(credentials.test.rules[0].properties.key, 'result.tools');
	assert.equal(credentials.test.rules[0].properties.value, undefined);
});
