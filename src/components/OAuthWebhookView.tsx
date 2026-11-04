import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  GitBranch,
  KeyRound,
  Link2,
  Send,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import type { DeployConfig } from '../utils/cicdLogic';

export interface GithubAuthInfo {
  connected: boolean;
  method: 'oauth' | 'token' | 'repo-link' | null;
  username: string;
  avatarUrl: string;
  scopes: string[];
  connectedAt: string | null;
  oauthConfigured: boolean;
}

export interface WebhookEventItem {
  id: string;
  event: string;
  deliveryId: string;
  repoFullName: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  triggeredDeploy: boolean;
  reason: string;
  receivedAt: string;
}

export interface RuntimeUrls {
  devAppUrl: string;
  sharedAppUrl: string;
  devCallbackUrl: string;
  sharedCallbackUrl: string;
  webhookEndpointUrl: string;
}

interface OAuthWebhookViewProps {
  config: DeployConfig;
  githubAuth: GithubAuthInfo;
  webhookEvents: WebhookEventItem[];
  runtimeUrls: RuntimeUrls;
  onOpenGithubOAuth: () => Promise<void>;
  onConnectRepoOrToken: (params: {
    username: string;
    repoName: string;
    branch: string;
    token?: string;
  }) => Promise<void>;
  onDisconnectGithub: () => Promise<void>;
  onSendTestWebhook: (payload: {
    branch: string;
    commitMessage: string;
  }) => Promise<void>;
}

export const OAuthWebhookView: React.FC<OAuthWebhookViewProps> = ({
  config,
  githubAuth,
  webhookEvents,
  runtimeUrls,
  onOpenGithubOAuth,
  onConnectRepoOrToken,
  onDisconnectGithub,
  onSendTestWebhook,
}) => {
  const [ownerInput, setOwnerInput] = useState(config.repoOwner);
  const [repoInput, setRepoInput] = useState(config.repoName);
  const [branchInput, setBranchInput] = useState(config.branch);
  const [tokenInput, setTokenInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [testBranch, setTestBranch] = useState(config.branch);
  const [testMessage, setTestMessage] = useState(
    'feat(aria): automatic webhook deploy on commit to StreamFlowAria'
  );
  const [sendingWebhook, setSendingWebhook] = useState(false);

  const copyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerInput.trim() || !repoInput.trim() || !branchInput.trim()) {
      setFormError('Заполните владельца, имя репозитория и целевую ветку.');
      setFormSuccess(null);
      return;
    }
    setFormError(null);
    await onConnectRepoOrToken({
      username: ownerInput.trim(),
      repoName: repoInput.trim(),
      branch: branchInput.trim(),
      token: tokenInput.trim() || undefined,
    });
    setTokenInput('');
    setFormSuccess(
      `Репозиторий ${ownerInput.trim()}/${repoInput.trim()} (ветка ${branchInput.trim()}) успешно привязан к пайплайну автодеплоя.`
    );
  };

  const handleTriggerWebhookTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim()) return;
    setSendingWebhook(true);
    try {
      await onSendTestWebhook({
        branch: testBranch.trim() || config.branch,
        commitMessage: testMessage.trim(),
      });
    } finally {
      setSendingWebhook(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: GitHub Connection & Repository Binding */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                01. Привязка аккаунта GitHub и репозитория StreamFlowAria
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Авторизуйтесь через попап GitHub OAuth 2.0 или укажите токен доступа (PAT) для прямой записи workflow-файлов в репозиторий.
              </p>
            </div>
          </div>

          {/* Current connection state */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Статус:{' '}
                  {githubAuth.connected
                    ? `Подключено (${githubAuth.username}/${config.repoName})`
                    : 'Не подключено'}
                </span>
              </div>
              <div className="text-xs text-slate-600 font-mono">
                <span>Метод: {githubAuth.method || 'none'}</span>
                <span aria-hidden="true"> · </span>
                <span>Ветка: {config.branch}</span>
                <span aria-hidden="true"> · </span>
                <span>Права: {githubAuth.scopes.join(', ')}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenGithubOAuth}
                className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                Войти через GitHub OAuth
              </button>
              {githubAuth.connected && (
                <button
                  type="button"
                  onClick={onDisconnectGithub}
                  aria-label="Отключить GitHub"
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Отключить</span>
                </button>
              )}
            </div>
          </div>

          <form onSubmit={handleConnectSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="conn-owner"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Владелец (GitHub User)
                </label>
                <input
                  id="conn-owner"
                  type="text"
                  value={ownerInput}
                  onChange={(e) => setOwnerInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="conn-repo"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Имя репозитория
                </label>
                <input
                  id="conn-repo"
                  type="text"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="conn-branch"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Ветка автодеплоя
                </label>
                <input
                  id="conn-branch"
                  type="text"
                  value={branchInput}
                  onChange={(e) => setBranchInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="conn-token"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                GitHub Personal Access Token (опционально, для прямой записи через GitHub REST API)
              </label>
              <div className="relative">
                <input
                  id="conn-token"
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {formError && (
              <p role="alert" className="text-xs text-red-600">
                {formError}
              </p>
            )}
            {formSuccess && (
              <p role="status" className="text-xs text-emerald-700">
                {formSuccess}
              </p>
            )}

            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Link2 className="w-4 h-4" />
              <span>Привязать репозиторий и обновить интеграцию</span>
            </button>
          </form>
        </div>

        {/* Right: Exact OAuth Callback URLs & Webhook Endpoint */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              02. Параметры OAuth App и GitHub Webhooks
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Используйте эти точные URL контейнера при настройке GitHub OAuth App (
              <a
                href="https://github.com/settings/developers"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <span>github.com/settings/developers</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              ) и Webhooks в настройках репозитория <span className="font-mono">{config.repoName}</span>.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                <span>1. OAuth Callback URL (Development Container)</span>
                <button
                  type="button"
                  aria-label="Копировать Development OAuth Callback URL"
                  onClick={() => copyText('devCb', runtimeUrls.devCallbackUrl)}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'devCb' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 break-all">
                {runtimeUrls.devCallbackUrl}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                <span>2. OAuth Callback URL (Shared / Deployed Container)</span>
                <button
                  type="button"
                  aria-label="Копировать Shared OAuth Callback URL"
                  onClick={() => copyText('sharedCb', runtimeUrls.sharedCallbackUrl)}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'sharedCb' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 break-all">
                {runtimeUrls.sharedCallbackUrl}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                <span>3. Payload URL для GitHub Repository Webhooks (событие: push)</span>
                <button
                  type="button"
                  aria-label="Копировать GitHub Webhook Payload URL"
                  onClick={() => copyText('webhookUrl', runtimeUrls.webhookEndpointUrl)}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {copiedKey === 'webhookUrl' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Скопировано</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Копировать</span>
                    </>
                  )}
                </button>
              </div>
              <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 break-all">
                {runtimeUrls.webhookEndpointUrl}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-medium text-slate-800 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                <span>Переменные окружения в панели Secrets:</span>
              </div>
              <p className="font-mono text-slate-700">
                GITHUB_CLIENT_ID · GITHUB_CLIENT_SECRET · GITHUB_WEBHOOK_SECRET
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Webhook Simulator & Delivery Log */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              03. Журнал входящих GitHub Push-вебхуков и проверка триггера
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Проверьте, как обработчик <code className="font-mono">/api/webhooks/github</code> фильтрует ветки и теги <code className="font-mono">[skip ci]</code> перед запуском деплоя.
            </p>
          </div>

          <form onSubmit={handleTriggerWebhookTest} className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                aria-label="Тестовая ветка вебхука"
                value={testBranch}
                onChange={(e) => setTestBranch(e.target.value)}
                className="w-28 px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                placeholder="main"
              />
            </div>
            <input
              type="text"
              aria-label="Тестовое сообщение коммита для вебхука"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              className="w-64 sm:w-80 px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
              placeholder="Сообщение коммита..."
            />
            <button
              type="submit"
              disabled={sendingWebhook}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Отправить тестовый push-вебхук</span>
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-4">Время</th>
                <th className="py-2.5 px-4">Репозиторий · Ветка</th>
                <th className="py-2.5 px-4">Коммит</th>
                <th className="py-2.5 px-4">Решение пайплайна</th>
                <th className="py-2.5 pl-4 text-right">Статус триггера</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {webhookEvents.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/80">
                  <td className="py-3 pr-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {new Date(ev.receivedAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-800 whitespace-nowrap">
                    <span>{ev.repoFullName}</span>
                    <span aria-hidden="true" className="text-slate-400">
                      {' '}
                      /{' '}
                    </span>
                    <span className="font-semibold">{ev.branch}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                    <span className="font-mono text-slate-500">{ev.commitSha}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{ev.commitMessage}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{ev.reason}</td>
                  <td className="py-3 pl-4 text-right font-medium whitespace-nowrap">
                    {ev.triggeredDeploy ? (
                      <span className="text-emerald-700">Запущен автодеплой</span>
                    ) : (
                      <span className="text-amber-700">Пропущен</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
