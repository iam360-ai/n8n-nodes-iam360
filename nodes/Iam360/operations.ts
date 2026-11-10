import type { IDataObject } from 'n8n-workflow';

export interface ToolCall {
	name: string;
	args: IDataObject;
}
type ParameterReader = (name: string, fallback?: unknown) => unknown;

function text(value: unknown, label: string, min: number, max: number): string {
	if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max)
		throw new Error(`${label} must contain ${min} to ${max} characters.`);
	return value.trim();
}

function number(value: unknown, label: string, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max)
		throw new Error(`${label} must be an integer from ${min} to ${max}.`);
	return value;
}

function date(value: unknown): string | undefined {
	if (value === '' || value === undefined || value === null) return undefined;
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
		throw new Error('Date must use YYYY-MM-DD.');
	const parsed = new Date(`${value}T12:00:00Z`);
	if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
		throw new Error('Date must be a valid calendar date.');
	return value;
}

export function buildCall(resource: unknown, operation: unknown, get: ParameterReader): ToolCall {
	if (resource === 'overview' && operation === 'get') return { name: 'get_overview', args: {} };
	if (resource === 'metrics' && operation === 'get')
		return { name: 'get_daily_metrics', args: { days: number(get('days'), 'Days', 1, 90) } };
	if ((resource === 'nutrition' || resource === 'workout') && operation === 'get') {
		const day = date(get('date', ''));
		return {
			name: resource === 'nutrition' ? 'get_nutrition' : 'get_workouts',
			args: day ? { date: day } : {},
		};
	}
	if (resource === 'meal' && operation === 'create') {
		const args: IDataObject = {
			description: text(get('description'), 'Description', 2, 2000),
			calories: number(get('calories'), 'Calories', 0, 10000),
			protein: number(get('protein'), 'Protein', 0, 1000),
		};
		const options = get('additionalFields', {});
		if (options === null || typeof options !== 'object' || Array.isArray(options))
			throw new Error('Additional fields must be an object.');
		const fields = options as Record<string, unknown>;
		if (fields.name !== undefined && fields.name !== '')
			args.name = text(fields.name, 'Name', 1, 120);
		const day = date(fields.mealDate);
		if (day) args.mealDate = day;
		for (const field of ['carbs', 'fat'] as const)
			if (fields[field] !== undefined)
				args[field] = number(fields[field], field === 'carbs' ? 'Carbs' : 'Fat', 0, 2000);
		if (fields.allowDuplicate !== undefined) {
			if (typeof fields.allowDuplicate !== 'boolean')
				throw new Error('Allow Duplicate must be a boolean.');
			args.allowDuplicate = fields.allowDuplicate;
		}
		return { name: 'log_meal', args };
	}
	if (resource === 'meal' && operation === 'delete') {
		const id = text(get('mealId'), 'Meal ID', 36, 36);
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
			throw new Error('Meal ID must be a UUID returned by IAM360.');
		return { name: 'delete_meal', args: { mealId: id } };
	}
	throw new Error('Unsupported IAM360 resource or operation.');
}
