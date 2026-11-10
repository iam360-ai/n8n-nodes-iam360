import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { buildCall } from './operations';
import { callTool, CREDENTIAL_NAME, formatOverview, safeError } from './transport';

const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Daily Metric', value: 'metrics' },
			{ name: 'Meal', value: 'meal' },
			{ name: 'Nutrition', value: 'nutrition' },
			{ name: 'Overview', value: 'overview' },
			{ name: 'Workout', value: 'workout' },
		],
		default: 'overview',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['overview', 'metrics', 'nutrition', 'workout'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get fitness records',
				description: 'Get records from your connected IAM360 account',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['meal'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a meal',
				description: 'Log a meal with supplied nutrition values',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a meal',
				description: 'Delete a meal by its IAM360 ID',
			},
		],
		default: 'create',
	},
	{
		displayName: 'Output',
		name: 'output',
		type: 'options',
		displayOptions: { show: { resource: ['overview'], operation: ['get'] } },
		options: [
			{
				name: 'Simplified',
				value: 'simplified',
				description: 'Return the ten main overview fields',
			},
			{ name: 'Raw', value: 'raw', description: 'Return every available overview field' },
			{
				name: 'Selected Fields',
				value: 'selected',
				description: 'Return only the fields you choose',
			},
		],
		default: 'simplified',
		description: 'Choose how much overview data to return to the workflow or AI agent',
	},
	{
		displayName: 'Fields',
		name: 'overviewFields',
		type: 'multiOptions',
		displayOptions: {
			show: { resource: ['overview'], operation: ['get'], output: ['selected'] },
		},
		options: [
			{ name: 'Active Challenges', value: 'activeChallenges' },
			{ name: 'Local Time', value: 'localTime' },
			{ name: 'Nutrition', value: 'nutrition' },
			{ name: 'Planned Workout', value: 'plannedWorkout' },
			{ name: 'Recent Dates', value: 'recentDates' },
			{ name: 'Recent Events', value: 'recentEvents' },
			{ name: 'Recent Meals', value: 'recentMeals' },
			{ name: 'Recent Workouts', value: 'recentWorkouts' },
			{ name: 'Timezone', value: 'timezone' },
			{ name: 'Timezone Defaulted', value: 'timezoneDefaulted' },
			{ name: 'Today', value: 'today' },
			{ name: 'Unavailable Sections', value: 'unavailableSections' },
			{ name: 'Wearable', value: 'wearable' },
			{ name: 'Weekday', value: 'weekday' },
		],
		default: ['today', 'wearable', 'unavailableSections'],
		description: 'Overview fields to return. Record IDs within selected sections are preserved.',
	},
	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		default: 14,
		typeOptions: { minValue: 1, maxValue: 90, numberPrecision: 0 },
		displayOptions: { show: { resource: ['metrics'], operation: ['get'] } },
		description: 'Number of days to retrieve, oldest first. Missing measurements remain null.',
	},
	{
		displayName: 'Date',
		name: 'date',
		type: 'string',
		default: '',
		placeholder: '2026-11-08',
		displayOptions: { show: { resource: ['nutrition', 'workout'], operation: ['get'] } },
		description:
			"Calendar date in YYYY-MM-DD format. Leave empty for today's nutrition or this month's workouts in your IAM360 timezone.",
	},
	{
		displayName: 'Meal Description',
		name: 'description',
		type: 'string',
		default: '',
		required: true,
		typeOptions: { rows: 2 },
		placeholder: 'Oatmeal with banana',
		displayOptions: { show: { resource: ['meal'], operation: ['create'] } },
		description: 'Describe the meal in 2 to 2,000 characters',
	},
	{
		displayName: 'Calories (Kcal)',
		name: 'calories',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { minValue: 0, maxValue: 10000, numberPrecision: 0 },
		displayOptions: { show: { resource: ['meal'], operation: ['create'] } },
		description: 'Known calories for the meal. Enter the actual value; zero means zero calories.',
	},
	{
		displayName: 'Protein (Grams)',
		name: 'protein',
		type: 'number',
		default: 0,
		required: true,
		typeOptions: { minValue: 0, maxValue: 1000, numberPrecision: 0 },
		displayOptions: { show: { resource: ['meal'], operation: ['create'] } },
		description:
			'Known protein for the meal. Supplying both calories and protein avoids AI estimation.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		displayOptions: { show: { resource: ['meal'], operation: ['create'] } },
		options: [
			{
				displayName: 'Allow Duplicate',
				name: 'allowDuplicate',
				type: 'boolean',
				default: false,
				description:
					'Whether to intentionally allow a duplicate meal. Leave off for normal logging.',
			},
			{
				displayName: 'Carbs (Grams)',
				name: 'carbs',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0, maxValue: 2000, numberPrecision: 0 },
				description: 'Known carbohydrates. Omit this field if unknown.',
			},
			{
				displayName: 'Fat (Grams)',
				name: 'fat',
				type: 'number',
				default: 0,
				typeOptions: { minValue: 0, maxValue: 2000, numberPrecision: 0 },
				description: 'Known fat. Omit this field if unknown.',
			},
			{
				displayName: 'Meal Date',
				name: 'mealDate',
				type: 'string',
				default: '',
				placeholder: '2026-11-08',
				description: 'YYYY-MM-DD in your IAM360 timezone. Leave empty for today.',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'Optional short meal name, up to 120 characters',
			},
		],
	},
	{
		displayName: 'Meal ID',
		name: 'mealId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { resource: ['meal'], operation: ['delete'] } },
		description: 'UUID from Create Meal or Get Nutrition. Deletion affects your connected account.',
	},
];

export class Iam360 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'IAM360',
		name: 'iam360',
		// IAM360 supplies this square PNG logo; n8n's node docs permit PNG assets.
		icon: { light: 'file:../../icons/iam360.png', dark: 'file:../../icons/iam360.png' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read fitness records and manage meals in IAM360',
		defaults: { name: 'IAM360' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: CREDENTIAL_NAME, required: true }],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const output: INodeExecutionData[] = [];
		for (let index = 0; index < items.length; index++) {
			try {
				const call = buildCall(
					this.getNodeParameter('resource', index),
					this.getNodeParameter('operation', index),
					(name, fallback) => this.getNodeParameter(name, index, fallback as never),
				);
				const response = await callTool.call(this, call.name, call.args);
				const data =
					call.name === 'get_overview'
						? formatOverview(
								response,
								this.getNodeParameter('output', index, 'simplified'),
								this.getNodeParameter('overviewFields', index, []),
							)
						: response;
				output.push({ json: data, pairedItem: { item: index } });
			} catch (error) {
				const message = safeError(error);
				if (this.continueOnFail()) {
					output.push({ json: { error: message }, pairedItem: { item: index } });
					continue;
				}
				throw new NodeOperationError(this.getNode(), message, { itemIndex: index });
			}
		}
		return [output];
	}
}
