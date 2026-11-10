import type { ICredentialType, ICredentialTestRequest, INodeProperties, Icon } from 'n8n-workflow';

export class Iam360OAuth2Api implements ICredentialType {
	name = 'iam360OAuth2Api';
	displayName = 'IAM360 OAuth2 API';
	extends = ['oAuth2Api'];
	icon: Icon = { light: 'file:../icons/iam360.png', dark: 'file:../icons/iam360.png' };
	documentationUrl = 'https://app.iam360.ai/docs/mcp/connect';
	test: ICredentialTestRequest = {
		request: {
			method: 'POST',
			url: 'https://app.iam360.ai/api/mcp',
			headers: {
				Accept: 'application/json, text/event-stream',
				'Content-Type': 'application/json',
				'MCP-Protocol-Version': '2026-07-28',
				'Mcp-Method': 'tools/list',
			},
			body: {
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/list',
				params: {
					_meta: {
						'io.modelcontextprotocol/protocolVersion': '2026-07-28',
						'io.modelcontextprotocol/clientCapabilities': {},
					},
				},
			},
			json: true,
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'result.tools',
					value: undefined,
					message: 'IAM360 tool discovery failed. Reconnect your account and try again.',
				},
			},
		],
	};
	properties: INodeProperties[] = [
		{
			displayName:
				'Create your account at <a href="https://app.iam360.ai" target="_blank">app.iam360.ai</a>, then connect. Authorization permits reading, adding, editing, and deleting fitness records. n8n handles OAuth setup automatically.',
			name: 'accountNotice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'Use Dynamic Client Registration',
			name: 'useDynamicClientRegistration',
			type: 'hidden',
			default: true,
		},
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'hidden',
			default: 'https://app.iam360.ai/api/mcp',
		},
		{
			displayName: 'Resource URL',
			name: 'resourceUrl',
			type: 'hidden',
			default: 'https://app.iam360.ai/api/mcp',
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default: 'fitness offline_access',
		},
	];
}
