export type DeployTarget = 'cloud-run' | 'github-pages' | 'docker-webhook';

export interface DeployConfig {
  repoOwner: string;
  repoName: string;
  branch: string;
  targetPlatform: DeployTarget;
  nodeVersion: '20' | '22';
  installCommand: string;
  testCommand: string;
  buildCommand: string;
  autoDeployOnPush: boolean;
  runTestsBeforeDeploy: boolean;
  cancelInProgress: boolean;
  cloudRunService: string;
  cloudRunRegion: string;
  webhookUrl: string;
}

export interface DeploymentStage {
  id: string;
  name: string;
  status: 'success' | 'running' | 'failed' | 'queued';
  durationSec: number;
  logOutput: string;
}

export interface DeploymentRecord {
  id: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  branch: string;
  trigger: 'push' | 'manual' | 'webhook';
  status: 'success' | 'running' | 'failed';
  targetPlatform: DeployTarget;
  startedAt: string;
  durationSec: number;
  environmentUrl: string;
  stages: DeploymentStage[];
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const GIT_IDENTIFIER_REGEX = /^[a-zA-Z0-9._/-]+$/;

export function validateRepoConfig(input: Partial<DeployConfig>): ValidationResult {
  const errors: Record<string, string> = {};

  const owner = (input.repoOwner ?? '').trim();
  const repo = (input.repoName ?? '').trim();
  const branch = (input.branch ?? '').trim();
  const buildCmd = (input.buildCommand ?? '').trim();
  const installCmd = (input.installCommand ?? '').trim();

  if (!owner) {
    errors.repoOwner = 'Укажите владельца репозитория (GitHub username или организацию).';
  } else if (!GIT_IDENTIFIER_REGEX.test(owner)) {
    errors.repoOwner = 'Имя владельца содержит недопустимые символы.';
  }

  if (!repo) {
    errors.repoName = 'Укажите название репозитория (например, StreamFlowAria).';
  } else if (!GIT_IDENTIFIER_REGEX.test(repo)) {
    errors.repoName = 'Название репозитория содержит недопустимые символы.';
  }

  if (!branch) {
    errors.branch = 'Укажите целевую ветку для автодеплоя (например, main).';
  } else if (!GIT_IDENTIFIER_REGEX.test(branch)) {
    errors.branch = 'Название ветки содержит недопустимые символы.';
  }

  if (!installCmd) {
    errors.installCommand = 'Команда установки зависимостей обязательна.';
  }

  if (!buildCmd) {
    errors.buildCommand = 'Команда сборки проекта обязательна.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function shouldTriggerAutoDeploy(
  config: DeployConfig,
  payload: {
    ref: string;
    commits?: Array<{ message: string; id?: string; author?: { name?: string } }>;
  }
): { trigger: boolean; reason: string; branch: string } {
  const refPrefix = 'refs/heads/';
  const branch = payload.ref.startsWith(refPrefix)
    ? payload.ref.slice(refPrefix.length)
    : payload.ref;

  if (!config.autoDeployOnPush) {
    return {
      trigger: false,
      reason: 'Автоматический деплой при git push отключен в настройках.',
      branch,
    };
  }

  if (branch !== config.branch) {
    return {
      trigger: false,
      reason: `Коммит отправлен в ветку "${branch}", а автодеплой настроен только на "${config.branch}".`,
      branch,
    };
  }

  const latestMessage = payload.commits?.[payload.commits.length - 1]?.message ?? '';
  if (
    latestMessage.toLowerCase().includes('[skip ci]') ||
    latestMessage.toLowerCase().includes('[no deploy]')
  ) {
    return {
      trigger: false,
      reason: 'Обнаружена метка [skip ci] / [no deploy] в сообщении коммита.',
      branch,
    };
  }

  return {
    trigger: true,
    reason: `Автодеплой запущен для ветки "${branch}" (${config.repoOwner}/${config.repoName}).`,
    branch,
  };
}

export function generateGithubActionsYaml(config: DeployConfig): string {
  const concurrencyBlock = config.cancelInProgress
    ? `concurrency:\n  group: "${config.repoName.toLowerCase()}-deploy-\${{ github.ref }}"\n  cancel-in-progress: true\n\n`
    : '';

  const testStep = config.runTestsBeforeDeploy
    ? `      - name: Проверка типов и модульные тесты\n        run: ${config.testCommand}\n\n`
    : '';

  let deployJob = '';

  if (config.targetPlatform === 'cloud-run') {
    deployJob = `  deploy-cloud-run:
    name: Деплой в Google Cloud Run (${config.cloudRunService})
    needs: build-and-verify
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/${config.branch}'
    steps:
      - name: Клонирование ${config.repoOwner}/${config.repoName}
        uses: actions/checkout@v4

      - name: Авторизация в Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_SA_KEY }}

      - name: Деплой контейнера в Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${config.cloudRunService}
          region: ${config.cloudRunRegion}
          source: .
          flags: "--allow-unauthenticated --port=3000"`;
  } else if (config.targetPlatform === 'github-pages') {
    deployJob = `  deploy-pages:
    name: Публикация в GitHub Pages
    needs: build-and-verify
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/${config.branch}'
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Скачивание собранного артефакта
        uses: actions/download-artifact@v4
        with:
          name: ${config.repoName.toLowerCase()}-dist
          path: ./dist

      - name: Настройка GitHub Pages
        uses: actions/configure-pages@v5

      - name: Загрузка артефакта Pages
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Деплой на GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4`;
  } else {
    deployJob = `  deploy-webhook:
    name: Триггер продакшн-деплоя по Webhook
    needs: build-and-verify
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/${config.branch}'
    steps:
      - name: Отправка уведомления о сборке в пайплайн StreamFlowAria
        run: |
          curl -X POST "${config.webhookUrl}" \\
            -H "Content-Type: application/json" \\
            -H "X-GitHub-Event: push" \\
            -d '{"ref":"refs/heads/${config.branch}","repository":{"full_name":"${config.repoOwner}/${config.repoName}"},"after":"\${{ github.sha }}"}'`;
  }

  return `name: ${config.repoName} Auto-Deploy on Commit

on:
  push:
    branches:
      - ${config.branch}
  workflow_dispatch:

permissions:
  contents: read
  id-token: write
  pages: write

${concurrencyBlock}jobs:
  build-and-verify:
    name: Сборка и проверка (${config.repoName})
    runs-on: ubuntu-latest
    steps:
      - name: Клонирование репозитория ${config.repoOwner}/${config.repoName}
        uses: actions/checkout@v4

      - name: Установка Node.js ${config.nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: "${config.nodeVersion}"
          cache: "npm"

      - name: Установка зависимостей
        run: ${config.installCommand}

${testStep}      - name: Продакшн-сборка
        run: ${config.buildCommand}

      - name: Сохранение артефакта сборки
        uses: actions/upload-artifact@v4
        with:
          name: ${config.repoName.toLowerCase()}-dist
          path: dist/
          retention-days: 7

${deployJob}
`;
}

export function computeDeploymentMetrics(deployments: DeploymentRecord[]) {
  const total = deployments.length;
  if (total === 0) {
    return {
      total: 0,
      successCount: 0,
      failedCount: 0,
      successRate: 100,
      avgDurationSec: 0,
      latestSha: '—',
    };
  }

  const completed = deployments.filter((d) => d.status !== 'running');
  const successCount = deployments.filter((d) => d.status === 'success').length;
  const failedCount = deployments.filter((d) => d.status === 'failed').length;
  const successRate =
    completed.length > 0 ? Math.round((successCount / completed.length) * 100) : 100;
  const avgDurationSec =
    completed.length > 0
      ? Math.round(completed.reduce((acc, item) => acc + item.durationSec, 0) / completed.length)
      : 0;

  return {
    total,
    successCount,
    failedCount,
    successRate,
    avgDurationSec,
    latestSha: deployments[0]?.commitSha.slice(0, 7) ?? '—',
  };
}
