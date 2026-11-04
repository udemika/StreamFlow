import React, { useState } from 'react';
import { Check, Copy, Download, FileCode, RefreshCw, Terminal } from 'lucide-react';
import {
  generateGithubActionsYaml,
  validateRepoConfig,
  type DeployConfig,
  type DeployTarget,
} from '../utils/cicdLogic';

interface WorkflowBuilderViewProps {
  config: DeployConfig;
  onSaveConfig: (updated: DeployConfig) => Promise<void>;
  onSyncWorkflow: () => Promise<{ ok: boolean; message: string }>;
}

export const WorkflowBuilderView: React.FC<WorkflowBuilderViewProps> = ({
  config,
  onSaveConfig,
  onSyncWorkflow,
}) => {
  const [draft, setDraft] = useState<DeployConfig>(config);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const previewYaml = generateGithubActionsYaml(draft);

  const handleFieldChange = <K extends keyof DeployConfig>(key: K, value: DeployConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    }
  };

  const handleApplyAndSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateRepoConfig(draft);
    if (!validation.valid) {
      setErrors(validation.errors);
      setSyncStatus(null);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      await onSaveConfig(draft);
      const res = await onSyncWorkflow();
      setSyncStatus(res.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(previewYaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
    }
  };

  const handleDownloadYaml = () => {
    const blob = new Blob([previewYaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'deploy.yml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const targetOptions: Array<{ id: DeployTarget; label: string; desc: string }> = [
    {
      id: 'cloud-run',
      label: 'Google Cloud Run',
      desc: 'Контейнерный деплой в europe-west2 (рекомендуется для AI Studio)',
    },
    {
      id: 'github-pages',
      label: 'GitHub Pages',
      desc: 'Статический хостинг собранного бандла dist/ через actions/deploy-pages',
    },
    {
      id: 'docker-webhook',
      label: 'Production Webhook',
      desc: 'Сборка + отправка подписанного события в ваш серверный пайплайн',
    },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left column: Interactive Workflow Form */}
      <form
        onSubmit={handleApplyAndSync}
        className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        aria-label="Параметры генерации GitHub Actions"
      >
        <div className="border-b border-slate-200 pb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            01. Конфигурация пайплайна .github/workflows/deploy.yml
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Настройте триггер ветки и целевую платформу для автоматического деплоя при каждом коммите в{' '}
            <span className="font-mono font-medium text-slate-900">
              {draft.repoOwner}/{draft.repoName}
            </span>
            .
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="wf-repo-owner"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Владелец GitHub (Owner)
              </label>
              <input
                id="wf-repo-owner"
                type="text"
                value={draft.repoOwner}
                onChange={(e) => handleFieldChange('repoOwner', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                placeholder="aksarus"
              />
              {errors.repoOwner && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.repoOwner}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="wf-repo-name"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Репозиторий
              </label>
              <input
                id="wf-repo-name"
                type="text"
                value={draft.repoName}
                onChange={(e) => handleFieldChange('repoName', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                placeholder="StreamFlowAria"
              />
              {errors.repoName && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.repoName}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="wf-branch"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Целевая ветка (on.push.branches)
              </label>
              <input
                id="wf-branch"
                type="text"
                value={draft.branch}
                onChange={(e) => handleFieldChange('branch', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                placeholder="main"
              />
              {errors.branch && (
                <p className="text-xs text-red-600 mt-1" role="alert">
                  {errors.branch}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="wf-node-version"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Версия Node.js в Runner
              </label>
              <select
                id="wf-node-version"
                value={draft.nodeVersion}
                onChange={(e) =>
                  handleFieldChange('nodeVersion', e.target.value as '20' | '22')
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
              >
                <option value="22">Node.js 22 LTS</option>
                <option value="20">Node.js 20 LTS</option>
              </select>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-2">
              Целевая среда деплоя
            </span>
            <div className="space-y-2">
              {targetOptions.map((opt) => {
                const active = draft.targetPlatform === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleFieldChange('targetPlatform', opt.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      active
                        ? 'border-blue-600 bg-blue-50/50 text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{opt.label}</span>
                      <span className="text-xs font-mono text-slate-500">
                        {active ? 'Выбрано' : 'Выбрать'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {draft.targetPlatform === 'cloud-run' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label
                  htmlFor="wf-cr-service"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Сервис Cloud Run
                </label>
                <input
                  id="wf-cr-service"
                  type="text"
                  value={draft.cloudRunService}
                  onChange={(e) => handleFieldChange('cloudRunService', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>
              <div>
                <label
                  htmlFor="wf-cr-region"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Регион Cloud Run
                </label>
                <input
                  id="wf-cr-region"
                  type="text"
                  value={draft.cloudRunRegion}
                  onChange={(e) => handleFieldChange('cloudRunRegion', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="wf-build-cmd"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Команда сборки (Build)
            </label>
            <input
              id="wf-build-cmd"
              type="text"
              value={draft.buildCommand}
              onChange={(e) => handleFieldChange('buildCommand', e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
            />
            {errors.buildCommand && (
              <p className="text-xs text-red-600 mt-1" role="alert">
                {errors.buildCommand}
              </p>
            )}
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.runTestsBeforeDeploy}
                onChange={(e) =>
                  handleFieldChange('runTestsBeforeDeploy', e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Запускать проверку типов и модульные тесты перед деплоем</span>
            </label>

            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.cancelInProgress}
                onChange={(e) =>
                  handleFieldChange('cancelInProgress', e.target.checked)
                }
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Отменять предыдущую сборку при новом коммите (concurrency)</span>
            </label>
          </div>
        </div>

        {syncStatus && (
          <div
            role="status"
            className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900"
          >
            {syncStatus}
          </div>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
            <span>Сохранить и записать .github/workflows/deploy.yml</span>
          </button>
        </div>
      </form>

      {/* Right column: Generated YAML Preview & CLI instructions */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 bg-slate-50">
            <div className="flex items-center gap-2 text-sm font-mono font-medium text-slate-800">
              <FileCode className="w-4 h-4 text-blue-600 shrink-0" />
              <span>.github/workflows/deploy.yml</span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="text-xs text-slate-500">
                {draft.repoOwner}/{draft.repoName}@{draft.branch}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopyYaml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать YAML</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadYaml}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать .yml</span>
              </button>
            </div>
          </div>

          <pre className="p-5 text-xs font-mono leading-relaxed text-slate-100 bg-slate-900 overflow-x-auto max-h-[520px]">
            <code>{previewYaml}</code>
          </pre>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-semibold text-slate-900">
              02. Быстрая привязка локального или существующего репозитория StreamFlowAria
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Файл <code className="font-mono text-slate-900">.github/workflows/deploy.yml</code> уже создан в корне проекта. При каждом коммите (<code className="font-mono text-slate-900">git push origin {draft.branch}</code>) GitHub Actions автоматически выполнит установку зависимостей, прогон тестов и продакшн-деплой.
          </p>
          <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-100 rounded-lg overflow-x-auto">
            <code>{`git remote add origin https://github.com/${draft.repoOwner}/${draft.repoName}.git
git branch -M ${draft.branch}
git add .github/workflows/deploy.yml
git commit -m "ci: enable automatic deploy on every commit for ${draft.repoName}"
git push -u origin ${draft.branch}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
