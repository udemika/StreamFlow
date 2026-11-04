/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { OverviewPipelineView } from './components/OverviewPipelineView';
import { WorkflowBuilderView } from './components/WorkflowBuilderView';
import {
  OAuthWebhookView,
  type GithubAuthInfo,
  type RuntimeUrls,
  type WebhookEventItem,
} from './components/OAuthWebhookView';
import type { DeployConfig, DeploymentRecord } from './utils/cicdLogic';

const DEFAULT_DEV_URL =
  'https://ais-dev-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app';
const DEFAULT_SHARED_URL =
  'https://ais-pre-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app';

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'workflow' | 'oauth'>(
    'overview'
  );
  const handleSelectTab = useCallback((tab: 'overview' | 'workflow' | 'oauth') => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);
  const [loading, setLoading] = useState(true);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<DeployConfig>({
    repoOwner: 'aksarus',
    repoName: 'StreamFlowAria',
    branch: 'main',
    targetPlatform: 'cloud-run',
    nodeVersion: '22',
    installCommand: 'npm ci',
    testCommand: 'npm run lint && npx --yes tsx --test src/utils/cicdLogic.test.ts',
    buildCommand: 'npm run build',
    autoDeployOnPush: true,
    runTestsBeforeDeploy: true,
    cancelInProgress: true,
    cloudRunService: 'streamflow-aria',
    cloudRunRegion: 'europe-west2',
    webhookUrl: `${DEFAULT_SHARED_URL}/api/webhooks/github`,
  });

  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [githubAuth, setGithubAuth] = useState<GithubAuthInfo>({
    connected: true,
    method: 'repo-link',
    username: 'aksarus',
    avatarUrl: '',
    scopes: ['repo', 'workflow', 'admin:repo_hook'],
    connectedAt: null,
    oauthConfigured: false,
  });
  const [webhookEvents, setWebhookEvents] = useState<WebhookEventItem[]>([]);
  const [runtimeUrls, setRuntimeUrls] = useState<RuntimeUrls>({
    devAppUrl: DEFAULT_DEV_URL,
    sharedAppUrl: DEFAULT_SHARED_URL,
    devCallbackUrl: `${DEFAULT_DEV_URL}/auth/callback`,
    sharedCallbackUrl: `${DEFAULT_SHARED_URL}/auth/callback`,
    webhookEndpointUrl: `${DEFAULT_SHARED_URL}/api/webhooks/github`,
  });

  const fetchAppState = useCallback(async () => {
    try {
      const resp = await fetch('/api/state');
      if (!resp.ok) return;
      const data = await resp.json();
      if (data.config) setConfig(data.config);
      if (data.deployments) setDeployments(data.deployments);
      if (data.githubAuth) setGithubAuth(data.githubAuth);
      if (data.webhookEvents) setWebhookEvents(data.webhookEvents);
      if (data.runtimeUrls) setRuntimeUrls(data.runtimeUrls);
    } catch (err) {
      console.error('Failed to load CI/CD state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAppState();
  }, [fetchAppState]);

  // Listen for GitHub OAuth Popup completion via postMessage
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setBannerMessage('GitHub OAuth успешно подключен к StreamFlowAria.');
        fetchAppState();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchAppState]);

  const handleOpenGithubOAuth = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await fetch(
        `/api/auth/github/url?redirectUri=${encodeURIComponent(redirectUri)}`
      );
      const data = await response.json();
      if (!data.configured || !data.url) {
        setActiveTab('oauth');
        setBannerMessage(
          data.message ||
            'Для входа через попап GitHub OAuth задайте GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET или используйте форму привязки репозитория ниже.'
        );
        return;
      }

      window.open(data.url, 'oauth_popup', 'width=600,height=700');
    } catch (err) {
      console.error('OAuth popup error:', err);
    }
  };

  const handleSaveConfig = async (updated: DeployConfig) => {
    const resp = await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.config) setConfig(data.config);
      if (data.message) setBannerMessage(data.message);
    }
  };

  const handleToggleAutoDeploy = async (enabled: boolean) => {
    await handleSaveConfig({ ...config, autoDeployOnPush: enabled });
  };

  const handleSyncWorkflow = async (): Promise<{ ok: boolean; message: string }> => {
    const resp = await fetch('/api/github/sync-workflow', { method: 'POST' });
    const data = await resp.json();
    return {
      ok: Boolean(data.ok),
      message:
        data.message ||
        'Файл .github/workflows/deploy.yml синхронизирован для StreamFlowAria.',
    };
  };

  const handleTriggerCommitDeploy = async (params: {
    commitMessage: string;
    branch: string;
    triggerType: 'push' | 'manual';
  }) => {
    const resp = await fetch('/api/deployments/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitMessage: params.commitMessage,
        branch: params.branch,
        author: config.repoOwner,
        triggerType: params.triggerType,
      }),
    });
    const data = await resp.json();
    if (data.deployments) setDeployments(data.deployments);
    if (data.webhookEvents) setWebhookEvents(data.webhookEvents);
    return {
      triggered: Boolean(data.triggered),
      reason: data.reason || 'Сборка обработана.',
    };
  };

  const handleQuickManualDeploy = async () => {
    const res = await handleTriggerCommitDeploy({
      commitMessage: `chore(deploy): manual production release of ${config.repoName}`,
      branch: config.branch,
      triggerType: 'manual',
    });
    setBannerMessage(res.reason);
    setActiveTab('overview');
  };

  const handleConnectRepoOrToken = async (params: {
    username: string;
    repoName: string;
    branch: string;
    token?: string;
  }) => {
    const resp = await fetch('/api/auth/github/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.config) setConfig(data.config);
      if (data.githubAuth) setGithubAuth(data.githubAuth);
    }
  };

  const handleDisconnectGithub = async () => {
    const resp = await fetch('/api/auth/logout', { method: 'POST' });
    if (resp.ok) {
      const data = await resp.json();
      if (data.githubAuth) setGithubAuth(data.githubAuth);
      setBannerMessage('Сессия GitHub отключена.');
    }
  };

  const handleSendTestWebhook = async (payload: {
    branch: string;
    commitMessage: string;
  }) => {
    const resp = await fetch('/api/webhooks/github', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': 'push',
      },
      body: JSON.stringify({
        ref: `refs/heads/${payload.branch}`,
        repository: {
          full_name: `${config.repoOwner}/${config.repoName}`,
        },
        pusher: { name: config.repoOwner },
        commits: [
          {
            message: payload.commitMessage,
            author: { name: config.repoOwner },
          },
        ],
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.deployments) setDeployments(data.deployments);
      if (data.webhookEvents) setWebhookEvents(data.webhookEvents);
      if (data.evaluation?.reason) setBannerMessage(data.evaluation.reason);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            handleSelectTab('overview');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          StreamFlowAria CI/CD
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Основная навигация"
          className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
        >
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              handleSelectTab('overview');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'overview'
                ? 'text-slate-900 border-b-2 border-blue-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Обзор и Деплои
          </a>
          <a
            href="#workflow"
            onClick={(e) => {
              e.preventDefault();
              handleSelectTab('workflow');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'workflow'
                ? 'text-slate-900 border-b-2 border-blue-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Actions YAML
          </a>
          <a
            href="#oauth"
            onClick={(e) => {
              e.preventDefault();
              handleSelectTab('oauth');
            }}
            className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'oauth'
                ? 'text-slate-900 border-b-2 border-blue-600 font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            GitHub OAuth и Вебхуки
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleQuickManualDeploy}
            className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            Запустить деплой сейчас
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-6">
        {bannerMessage && (
          <div
            role="status"
            className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-950"
          >
            <span>{bannerMessage}</span>
            <button
              type="button"
              onClick={() => setBannerMessage(null)}
              className="text-blue-700 hover:underline font-medium shrink-0 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
            <div className="h-6 w-64 bg-slate-200 rounded animate-pulse" />
            <div className="h-4 w-96 bg-slate-100 rounded animate-pulse" />
            <div className="grid grid-cols-4 gap-4 pt-4">
              <div className="h-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-16 bg-slate-100 rounded animate-pulse" />
              <div className="h-16 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        ) : activeTab === 'overview' ? (
          <OverviewPipelineView
            config={config}
            deployments={deployments}
            githubAuth={githubAuth}
            runtimeUrls={runtimeUrls}
            onToggleAutoDeploy={handleToggleAutoDeploy}
            onTriggerCommitDeploy={handleTriggerCommitDeploy}
            onNavigateTab={handleSelectTab}
          />
        ) : activeTab === 'workflow' ? (
          <WorkflowBuilderView
            config={config}
            onSaveConfig={handleSaveConfig}
            onSyncWorkflow={handleSyncWorkflow}
          />
        ) : (
          <OAuthWebhookView
            config={config}
            githubAuth={githubAuth}
            webhookEvents={webhookEvents}
            runtimeUrls={runtimeUrls}
            onOpenGithubOAuth={handleOpenGithubOAuth}
            onConnectRepoOrToken={handleConnectRepoOrToken}
            onDisconnectGithub={handleDisconnectGithub}
            onSendTestWebhook={handleSendTestWebhook}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            Репозиторий: {config.repoOwner}/{config.repoName} · Ветка автодеплоя: {config.branch}
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => handleSelectTab('workflow')}
              className="hover:text-slate-900 cursor-pointer"
            >
              .github/workflows/deploy.yml
            </button>
            <button
              type="button"
              onClick={() => handleSelectTab('oauth')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Настройки GitHub OAuth & Webhook
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
