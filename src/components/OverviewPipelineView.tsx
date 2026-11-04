import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitCommit,
  Play,
  Search,
  XCircle,
} from 'lucide-react';
import {
  computeDeploymentMetrics,
  type DeployConfig,
  type DeploymentRecord,
} from '../utils/cicdLogic';
import type { GithubAuthInfo, RuntimeUrls } from './OAuthWebhookView';

interface OverviewPipelineViewProps {
  config: DeployConfig;
  deployments: DeploymentRecord[];
  githubAuth: GithubAuthInfo;
  runtimeUrls: RuntimeUrls;
  onToggleAutoDeploy: (enabled: boolean) => Promise<void>;
  onTriggerCommitDeploy: (params: {
    commitMessage: string;
    branch: string;
    triggerType: 'push' | 'manual';
  }) => Promise<{ triggered: boolean; reason: string }>;
  onNavigateTab: (tab: 'overview' | 'workflow' | 'oauth') => void;
}

export const OverviewPipelineView: React.FC<OverviewPipelineViewProps> = ({
  config,
  deployments,
  githubAuth,
  runtimeUrls,
  onToggleAutoDeploy,
  onTriggerCommitDeploy,
  onNavigateTab,
}) => {
  const [commitMessage, setCommitMessage] = useState('');
  const [commitBranch, setCommitBranch] = useState(config.branch);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [triggerFeedback, setTriggerFeedback] = useState<{
    triggered: boolean;
    reason: string;
  } | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDeployId, setExpandedDeployId] = useState<string | null>(
    deployments[0]?.id ?? null
  );

  const metrics = computeDeploymentMetrics(deployments);

  const filteredDeployments = deployments.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        d.commitMessage.toLowerCase().includes(q) ||
        d.commitSha.toLowerCase().includes(q) ||
        d.branch.toLowerCase().includes(q) ||
        d.author.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCommitPushSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = commitMessage.trim();
    if (!trimmed) {
      setCommitError('Введите сообщение коммита перед отправкой в пайплайн.');
      setTriggerFeedback(null);
      return;
    }

    setCommitError(null);
    setIsTriggering(true);
    try {
      const result = await onTriggerCommitDeploy({
        commitMessage: trimmed,
        branch: commitBranch.trim() || config.branch,
        triggerType: 'push',
      });
      setTriggerFeedback(result);
      if (result.triggered) {
        setCommitMessage('');
      }
    } finally {
      setIsTriggering(false);
    }
  };

  React.useEffect(() => {
    if (deployments[0]?.id) {
      setExpandedDeployId(deployments[0].id);
    }
  }, [deployments[0]?.id]);

  return (
    <div className="space-y-8">
      {/* Repository Status Bar & Quick Controls */}
      <section
        aria-label="Статус репозитория и автодеплоя"
        className="bg-white border border-slate-200 rounded-xl p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
              <span>GitHub Репозиторий</span>
              <span aria-hidden="true">·</span>
              <span>
                {githubAuth.connected ? `Привязан (${githubAuth.username})` : 'Ожидает авторизации'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Целевая ветка: {config.branch}</span>
              <span aria-hidden="true">·</span>
              <span>Платформа: {config.targetPlatform}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              {config.repoOwner}/{config.repoName}
            </h1>

            <p className="text-sm text-slate-600 max-w-2xl">
              Автоматическая сборка, проверка типов, модульные тесты и деплой при каждом коммите в ветку{' '}
              <code className="font-mono font-medium text-slate-900">{config.branch}</code> через{' '}
              <code className="font-mono font-medium text-slate-900">
                .github/workflows/deploy.yml
              </code>{' '}
              и серверный GitHub Webhook.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onToggleAutoDeploy(!config.autoDeployOnPush)}
              className={`px-4 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                config.autoDeployOnPush
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                  : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {config.autoDeployOnPush
                ? 'Автодеплой при коммите: Включен'
                : 'Автодеплой при коммите: Выключен'}
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('workflow')}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Открыть .github/workflows/deploy.yml
            </button>

            <a
              href={runtimeUrls.sharedAppUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>Продакшн URL</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 4-Column KPI Metrics Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6 mt-6 border-t border-slate-200">
          <div>
            <div className="text-xs text-slate-500">Всего автоматических деплоев</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {metrics.total}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Успешно: {metrics.successCount} · Ошибок: {metrics.failedCount}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Стабильность пайплайна</div>
            <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {metrics.successRate}%
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Проверка tsc + node:test активна
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Среднее время деплоя</div>
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {metrics.avgDurationSec} с
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Регион: {config.cloudRunRegion}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500">Активная ревизия (HEAD SHA)</div>
            <div className="text-2xl font-bold text-blue-600 font-mono tabular-nums mt-1">
              {metrics.latestSha}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Ветка: {config.branch}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Commit Simulator & Auto-Deploy Trigger */}
      <section
        aria-label="Симуляция коммита и запуск автодеплоя"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              01. Проверить автодеплой при коммите (git push → StreamFlowAria)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Отправьте тестовый коммит в ветку <code className="font-mono">{config.branch}</code>, чтобы запустить полный цикл сборки и деплоя в реальном времени.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Триггер: on.push.branches [{config.branch}]
          </span>
        </div>

        <form
          onSubmit={handleCommitPushSubmit}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start"
        >
          <div className="md:col-span-3">
            <label
              htmlFor="sim-branch-input"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Ветка коммита
            </label>
            <input
              id="sim-branch-input"
              type="text"
              value={commitBranch}
              onChange={(e) => setCommitBranch(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="main"
            />
          </div>

          <div className="md:col-span-6">
            <label
              htmlFor="sim-commit-msg"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Сообщение коммита (Commit message)
            </label>
            <input
              id="sim-commit-msg"
              type="text"
              value={commitMessage}
              onChange={(e) => {
                setCommitMessage(e.target.value);
                if (commitError) setCommitError(null);
              }}
              placeholder="feat: optimize StreamFlowAria audio streaming pipeline"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {commitError && (
              <p role="alert" className="text-xs text-red-600 mt-1">
                {commitError}
              </p>
            )}
          </div>

          <div className="md:col-span-3 md:pt-5">
            <button
              type="submit"
              disabled={isTriggering}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>Отправить коммит и задеплоить</span>
            </button>
          </div>
        </form>

        {triggerFeedback && (
          <div
            role="status"
            className={`p-3 rounded-lg border text-xs ${
              triggerFeedback.triggered
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {triggerFeedback.reason}
          </div>
        )}
      </section>

      {/* Deployment History & Stage Logs */}
      <section
        aria-label="История автоматических деплоев StreamFlowAria"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              02. Журнал сборок и деплоев репозитория {config.repoName}
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Нажмите на любую сборку для просмотра пошаговых логов выполнения этапов CI/CD.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Interactive Filter Controls */}
            <div
              role="group"
              aria-label="Фильтр статуса сборок"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Все ({deployments.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('success')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'success'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Успешные
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('failed')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  statusFilter === 'failed'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ошибки
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Поиск по коммитам или SHA"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по коммиту или SHA..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>

        {filteredDeployments.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Сборки по заданному фильтру не найдены.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setSearchQuery('');
              }}
              className="px-3.5 py-1.5 text-xs font-medium text-blue-600 hover:underline cursor-pointer"
            >
              Сбросить фильтр
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredDeployments.map((dep) => {
              const isExpanded = expandedDeployId === dep.id;
              return (
                <div key={dep.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {dep.status === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-slate-900">
                          {dep.commitMessage}
                        </span>
                      </div>

                      {/* Unboxed clean metadata with typographic separators */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                          {dep.commitSha.slice(0, 7)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Ветка: {dep.branch}</span>
                        <span aria-hidden="true">·</span>
                        <span>Автор: {dep.author}</span>
                        <span aria-hidden="true">·</span>
                        <span>Триггер: {dep.trigger}</span>
                        <span aria-hidden="true">·</span>
                        <span>Длительность: {dep.durationSec} с</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Статус: {dep.status === 'success' ? 'Успешно задеплоено' : 'Ошибка'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        aria-label={`Этапы сборки (${dep.stages.length}) для коммита ${dep.commitSha.slice(0, 7)}`}
                        onClick={() =>
                          setExpandedDeployId(isExpanded ? null : dep.id)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <span>Этапы сборки ({dep.stages.length})</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && dep.stages.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                      {dep.stages.map((st, idx) => (
                        <div
                          key={st.id}
                          className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono space-y-1"
                        >
                          <div className="flex items-center justify-between text-slate-300">
                            <span>
                              0{idx + 1}. {st.name}
                            </span>
                            <span className="tabular-nums text-emerald-400">
                              {st.status === 'success' ? 'OK' : st.status} · {st.durationSec}s
                            </span>
                          </div>
                          <div className="text-slate-400 break-all">{st.logOutput}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
