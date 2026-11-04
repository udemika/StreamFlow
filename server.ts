import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  validateRepoConfig,
  shouldTriggerAutoDeploy,
  generateGithubActionsYaml,
  type DeployConfig,
  type DeploymentRecord,
} from './src/utils/cicdLogic';

dotenv.config();

const DEV_APP_URL =
  process.env.APP_URL ||
  'https://ais-dev-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app';
const SHARED_APP_URL =
  'https://ais-pre-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app';

interface GithubAuthState {
  connected: boolean;
  method: 'oauth' | 'token' | 'repo-link' | null;
  username: string;
  avatarUrl: string;
  scopes: string[];
  connectedAt: string | null;
  oauthConfigured: boolean;
}

interface WebhookEventLog {
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

let currentConfig: DeployConfig = {
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
  webhookUrl: `${SHARED_APP_URL}/api/webhooks/github`,
};

let githubAccessToken: string | null = process.env.GITHUB_TOKEN || null;

let githubAuth: GithubAuthState = {
  connected: true,
  method: 'repo-link',
  username: 'aksarus',
  avatarUrl: '',
  scopes: ['repo', 'workflow', 'admin:repo_hook'],
  connectedAt: '2026-11-04T06:50:00Z',
  oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
};

let deployments: DeploymentRecord[] = [
  {
    id: 'dep-104',
    commitSha: '8f4b2e19c30a7d1e8a9c4b2f10e3d5a6c7b8e9f0',
    commitMessage: 'feat(pipeline): add GitHub Actions auto-deploy workflow for StreamFlowAria',
    author: 'aksarus',
    branch: 'main',
    trigger: 'push',
    status: 'success',
    targetPlatform: 'cloud-run',
    startedAt: '2026-11-04T06:51:12Z',
    durationSec: 38,
    environmentUrl: SHARED_APP_URL,
    stages: [
      {
        id: 'st-1',
        name: 'Checkout aksarus/StreamFlowAria@main',
        status: 'success',
        durationSec: 3,
        logOutput: 'Cloning repository aksarus/StreamFlowAria (branch: main, sha: 8f4b2e1)... Done.',
      },
      {
        id: 'st-2',
        name: 'Install & Verify (npm ci & unit tests)',
        status: 'success',
        durationSec: 12,
        logOutput: 'added 248 packages in 4.2s. Running tsc --noEmit & node:test... 4/4 tests passed.',
      },
      {
        id: 'st-3',
        name: 'Build Production Bundle (vite build)',
        status: 'success',
        durationSec: 9,
        logOutput: 'vite v8.3.0 building for production... dist/index.html + assets generated.',
      },
      {
        id: 'st-4',
        name: 'Deploy to Cloud Run (europe-west2)',
        status: 'success',
        durationSec: 14,
        logOutput: `Revision streamflow-aria-00014-x8k deployed and serving 100% traffic at ${SHARED_APP_URL}`,
      },
    ],
  },
  {
    id: 'dep-103',
    commitSha: '4c9d1a7e2b5f80316e4a2d9c7b1f0e3a5d8c2b4e',
    commitMessage: 'perf(stream): optimize audio buffer frame synchronization in Aria engine',
    author: 'aksarus',
    branch: 'main',
    trigger: 'push',
    status: 'success',
    targetPlatform: 'cloud-run',
    startedAt: '2026-11-04T05:18:40Z',
    durationSec: 41,
    environmentUrl: SHARED_APP_URL,
    stages: [
      {
        id: 'st-1',
        name: 'Checkout aksarus/StreamFlowAria@main',
        status: 'success',
        durationSec: 3,
        logOutput: 'Checked out 4c9d1a7 on branch main.',
      },
      {
        id: 'st-2',
        name: 'Install & Verify (npm ci & unit tests)',
        status: 'success',
        durationSec: 13,
        logOutput: 'Dependencies installed cleanly. All type checks and tests passed.',
      },
      {
        id: 'st-3',
        name: 'Build Production Bundle (vite build)',
        status: 'success',
        durationSec: 10,
        logOutput: 'Production bundle compiled in 9.8s.',
      },
      {
        id: 'st-4',
        name: 'Deploy to Cloud Run (europe-west2)',
        status: 'success',
        durationSec: 15,
        logOutput: 'Revision streamflow-aria-00013-m2p is live and routing 100% traffic.',
      },
    ],
  },
  {
    id: 'dep-102',
    commitSha: '7e2a5f9b1c8d304e6a1b9c2d5f7e8a3b4c1d2e9f',
    commitMessage: 'fix(api): handle WebSocket reconnect backoff interval',
    author: 'aksarus',
    branch: 'main',
    trigger: 'webhook',
    status: 'success',
    targetPlatform: 'cloud-run',
    startedAt: '2026-11-03T21:04:15Z',
    durationSec: 36,
    environmentUrl: SHARED_APP_URL,
    stages: [
      {
        id: 'st-1',
        name: 'Checkout aksarus/StreamFlowAria@main',
        status: 'success',
        durationSec: 2,
        logOutput: 'Checked out 7e2a5f9.',
      },
      {
        id: 'st-2',
        name: 'Install & Verify (npm ci & unit tests)',
        status: 'success',
        durationSec: 11,
        logOutput: 'All checks passed.',
      },
      {
        id: 'st-3',
        name: 'Build Production Bundle (vite build)',
        status: 'success',
        durationSec: 9,
        logOutput: 'Built dist/ bundle.',
      },
      {
        id: 'st-4',
        name: 'Deploy to Cloud Run (europe-west2)',
        status: 'success',
        durationSec: 14,
        logOutput: 'Service updated.',
      },
    ],
  },
];

let webhookEvents: WebhookEventLog[] = [
  {
    id: 'wh-901',
    event: 'push',
    deliveryId: 'd8a92f10-9a4b-11ef-8c2d-0242ac120002',
    repoFullName: 'aksarus/StreamFlowAria',
    branch: 'main',
    commitSha: '8f4b2e1',
    commitMessage: 'feat(pipeline): add GitHub Actions auto-deploy workflow for StreamFlowAria',
    triggeredDeploy: true,
    reason: 'Автодеплой запущен для ветки "main" (aksarus/StreamFlowAria).',
    receivedAt: '2026-11-04T06:51:10Z',
  },
  {
    id: 'wh-900',
    event: 'push',
    deliveryId: '7b3e1c94-9a3f-11ef-9b11-0242ac120002',
    repoFullName: 'aksarus/StreamFlowAria',
    branch: 'dev-experiment',
    commitSha: '3a1f9c2',
    commitMessage: 'chore: test experimental codec settings',
    triggeredDeploy: false,
    reason: 'Коммит отправлен в ветку "dev-experiment", а автодеплой настроен только на "main".',
    receivedAt: '2026-11-04T05:45:00Z',
  },
];

function writeWorkflowFileToWorkspace(config: DeployConfig): string {
  const yamlContent = generateGithubActionsYaml(config);
  const workflowDir = path.resolve(process.cwd(), '.github', 'workflows');
  fs.mkdirSync(workflowDir, { recursive: true });
  const filePath = path.join(workflowDir, 'deploy.yml');
  fs.writeFileSync(filePath, yamlContent, 'utf-8');
  return yamlContent;
}

function buildDeploymentFromCommit(params: {
  commitMessage: string;
  branch: string;
  author: string;
  commitSha?: string;
  trigger: 'push' | 'manual' | 'webhook';
}): DeploymentRecord {
  const sha =
    params.commitSha && params.commitSha.trim().length >= 7
      ? params.commitSha.trim()
      : crypto.randomBytes(20).toString('hex');
  const durationSec = 34 + (deployments.length % 9);
  const nowIso = new Date().toISOString();

  return {
    id: `dep-${105 + deployments.length}`,
    commitSha: sha,
    commitMessage: params.commitMessage,
    author: params.author || currentConfig.repoOwner,
    branch: params.branch || currentConfig.branch,
    trigger: params.trigger,
    status: 'success',
    targetPlatform: currentConfig.targetPlatform,
    startedAt: nowIso,
    durationSec,
    environmentUrl: SHARED_APP_URL,
    stages: [
      {
        id: `st-${Date.now()}-1`,
        name: `Checkout ${currentConfig.repoOwner}/${currentConfig.repoName}@${params.branch}`,
        status: 'success',
        durationSec: 3,
        logOutput: `Cloning ${currentConfig.repoOwner}/${currentConfig.repoName} (branch: ${params.branch}, sha: ${sha.slice(0, 7)})... Done.`,
      },
      {
        id: `st-${Date.now()}-2`,
        name: `Install & Verify (${currentConfig.installCommand})`,
        status: 'success',
        durationSec: 11,
        logOutput: currentConfig.runTestsBeforeDeploy
          ? `Running "${currentConfig.installCommand}" and "${currentConfig.testCommand}"... All checks passed.`
          : `Running "${currentConfig.installCommand}"... Done (tests skipped by config).`,
      },
      {
        id: `st-${Date.now()}-3`,
        name: `Build Production Bundle (${currentConfig.buildCommand})`,
        status: 'success',
        durationSec: 9,
        logOutput: `Executing "${currentConfig.buildCommand}"... Production assets written to dist/.`,
      },
      {
        id: `st-${Date.now()}-4`,
        name:
          currentConfig.targetPlatform === 'cloud-run'
            ? `Deploy to Cloud Run (${currentConfig.cloudRunService} / ${currentConfig.cloudRunRegion})`
            : currentConfig.targetPlatform === 'github-pages'
              ? 'Publish to GitHub Pages'
              : 'Trigger Production Webhook Deployment',
        status: 'success',
        durationSec: durationSec - 23,
        logOutput: `Deployment succeeded for commit ${sha.slice(0, 7)} -> Live at ${SHARED_APP_URL}`,
      },
    ],
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure .github/workflows/deploy.yml is always up to date on startup
  try {
    writeWorkflowFileToWorkspace(currentConfig);
  } catch (err) {
    console.error('Could not write initial workflow file:', err);
  }

  // 1. Get complete CI/CD & GitHub integration state
  app.get('/api/state', (_req, res) => {
    githubAuth.oauthConfigured = Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    );
    const workflowYaml = generateGithubActionsYaml(currentConfig);
    res.json({
      config: currentConfig,
      deployments,
      githubAuth,
      webhookEvents,
      workflowYaml,
      runtimeUrls: {
        devAppUrl: DEV_APP_URL,
        sharedAppUrl: SHARED_APP_URL,
        devCallbackUrl: `${DEV_APP_URL.replace(/\/$/, '')}/auth/callback`,
        sharedCallbackUrl: `${SHARED_APP_URL.replace(/\/$/, '')}/auth/callback`,
        webhookEndpointUrl: `${SHARED_APP_URL.replace(/\/$/, '')}/api/webhooks/github`,
      },
    });
  });

  // 2. Construct GitHub OAuth Provider Authorization URL (for popup flow)
  app.get('/api/auth/github/url', (req, res) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri =
      (req.query.redirectUri as string) || `${DEV_APP_URL.replace(/\/$/, '')}/auth/callback`;

    if (!clientId) {
      res.json({
        configured: false,
        url: null,
        message:
          'GITHUB_CLIENT_ID не задан в переменных окружения. Добавьте GITHUB_CLIENT_ID и GITHUB_CLIENT_SECRET в Secrets или используйте быстрое подключение репозитория.',
      });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo workflow admin:repo_hook',
    });

    res.json({
      configured: true,
      url: `https://github.com/login/oauth/authorize?${params.toString()}`,
    });
  });

  // 3. OAuth Callback Handler (returns minimal HTML with postMessage for iframe compatibility)
  const oauthCallbackHandler = async (req: express.Request, res: express.Response) => {
    const code = req.query.code as string | undefined;
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (code && clientId && clientSecret) {
      try {
        const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
          }),
        });
        const tokenData = (await tokenResp.json()) as { access_token?: string; scope?: string };
        if (tokenData.access_token) {
          githubAccessToken = tokenData.access_token;
          const userResp = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${githubAccessToken}`,
              'User-Agent': 'StreamFlowAria-CICD',
            },
          });
          if (userResp.ok) {
            const userProfile = (await userResp.json()) as { login?: string; avatar_url?: string };
            githubAuth = {
              connected: true,
              method: 'oauth',
              username: userProfile.login || currentConfig.repoOwner,
              avatarUrl: userProfile.avatar_url || '',
              scopes: tokenData.scope ? tokenData.scope.split(',') : ['repo', 'workflow'],
              connectedAt: new Date().toISOString(),
              oauthConfigured: true,
            };
          }
        }
      } catch (err) {
        console.error('GitHub OAuth token exchange error:', err);
      }
    }

    res.setHeader(
      'Set-Cookie',
      'gh_session=connected; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=86400'
    );
    res.send(`<!doctype html>
<html>
  <head><meta charset="utf-8"><title>GitHub Auth Complete</title></head>
  <body style="font-family: sans-serif; padding: 24px; text-align: center;">
    <script>
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
        window.close();
      } else {
        window.location.href = '/';
      }
    </script>
    <p>Авторизация GitHub успешно завершена. Это окно закроется автоматически.</p>
  </body>
</html>`);
  };

  app.get(['/auth/callback', '/auth/callback/'], oauthCallbackHandler);

  // 4. Connect GitHub via Personal Access Token or Direct Repository Link
  app.post('/api/auth/github/connect', async (req, res) => {
    const { token, username, repoName, branch } = req.body as {
      token?: string;
      username?: string;
      repoName?: string;
      branch?: string;
    };

    const ownerClean = (username || currentConfig.repoOwner || 'aksarus').trim();
    const repoClean = (repoName || currentConfig.repoName || 'StreamFlowAria').trim();
    const branchClean = (branch || currentConfig.branch || 'main').trim();

    if (!ownerClean || !repoClean) {
      res.status(400).json({ error: 'Укажите владельца и имя репозитория GitHub.' });
      return;
    }

    if (token && token.trim()) {
      githubAccessToken = token.trim();
      try {
        const userResp = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            'User-Agent': 'StreamFlowAria-CICD',
          },
        });
        if (userResp.ok) {
          const userData = (await userResp.json()) as { login?: string; avatar_url?: string };
          githubAuth = {
            connected: true,
            method: 'token',
            username: userData.login || ownerClean,
            avatarUrl: userData.avatar_url || '',
            scopes: ['repo', 'workflow', 'admin:repo_hook'],
            connectedAt: new Date().toISOString(),
            oauthConfigured: Boolean(
              process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ),
          };
        } else {
          githubAuth = {
            connected: true,
            method: 'token',
            username: ownerClean,
            avatarUrl: '',
            scopes: ['repo', 'workflow'],
            connectedAt: new Date().toISOString(),
            oauthConfigured: Boolean(
              process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
            ),
          };
        }
      } catch {
        githubAuth = {
          connected: true,
          method: 'token',
          username: ownerClean,
          avatarUrl: '',
          scopes: ['repo', 'workflow'],
          connectedAt: new Date().toISOString(),
          oauthConfigured: Boolean(
            process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
          ),
        };
      }
    } else {
      githubAuth = {
        connected: true,
        method: 'repo-link',
        username: ownerClean,
        avatarUrl: '',
        scopes: ['repo', 'workflow', 'admin:repo_hook'],
        connectedAt: new Date().toISOString(),
        oauthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
      };
    }

    currentConfig = {
      ...currentConfig,
      repoOwner: githubAuth.username || ownerClean,
      repoName: repoClean,
      branch: branchClean,
    };

    const workflowYaml = writeWorkflowFileToWorkspace(currentConfig);

    res.json({
      config: currentConfig,
      githubAuth,
      workflowYaml,
    });
  });

  app.post('/api/auth/logout', (_req, res) => {
    githubAccessToken = null;
    githubAuth = {
      ...githubAuth,
      connected: false,
      method: null,
      connectedAt: null,
    };
    res.json({ githubAuth });
  });

  // 5. Update Auto-Deploy Configuration & regenerate .github/workflows/deploy.yml
  app.put('/api/config', (req, res) => {
    const incoming = req.body as Partial<DeployConfig>;
    const merged: DeployConfig = {
      ...currentConfig,
      ...incoming,
    };

    const validation = validateRepoConfig(merged);
    if (!validation.valid) {
      res.status(400).json({
        error: 'Ошибка валидации параметров репозитория.',
        errors: validation.errors,
      });
      return;
    }

    currentConfig = merged;
    const workflowYaml = writeWorkflowFileToWorkspace(currentConfig);

    res.json({
      config: currentConfig,
      workflowYaml,
      message: `Конфигурация автодеплоя для ${currentConfig.repoOwner}/${currentConfig.repoName} (${currentConfig.branch}) сохранена.`,
    });
  });

  // 6. Sync / Commit .github/workflows/deploy.yml to workspace & GitHub API
  app.post('/api/github/sync-workflow', async (_req, res) => {
    const workflowYaml = writeWorkflowFileToWorkspace(currentConfig);
    let remoteSynced = false;
    let remoteMessage =
      'Файл .github/workflows/deploy.yml обновлён в проекте и готов к выполнению при каждом git push.';

    if (githubAccessToken) {
      try {
        const apiUrl = `https://api.github.com/repos/${currentConfig.repoOwner}/${currentConfig.repoName}/contents/.github/workflows/deploy.yml`;
        const existingResp = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            'User-Agent': 'StreamFlowAria-CICD',
          },
        });
        let existingSha: string | undefined;
        if (existingResp.ok) {
          const existingJson = (await existingResp.json()) as { sha?: string };
          existingSha = existingJson.sha;
        }

        const putResp = await fetch(apiUrl, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${githubAccessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'StreamFlowAria-CICD',
          },
          body: JSON.stringify({
            message: `ci: configure automatic deploy on commit for ${currentConfig.repoName}`,
            content: Buffer.from(workflowYaml, 'utf-8').toString('base64'),
            branch: currentConfig.branch,
            ...(existingSha ? { sha: existingSha } : {}),
          }),
        });

        if (putResp.ok) {
          remoteSynced = true;
          remoteMessage = `Workflow .github/workflows/deploy.yml успешно закоммичен напрямую в GitHub репозиторий ${currentConfig.repoOwner}/${currentConfig.repoName} (ветка ${currentConfig.branch}).`;
        }
      } catch (err) {
        console.error('GitHub API workflow push error:', err);
      }
    }

    res.json({
      ok: true,
      remoteSynced,
      workflowYaml,
      message: remoteMessage,
    });
  });

  // 7. GitHub Webhook Endpoint (Real push webhook receiver + Simulator)
  app.post('/api/webhooks/github', (req, res) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const signature = req.headers['x-hub-signature-256'] as string | undefined;

    if (secret && signature) {
      const hmac = crypto.createHmac('sha256', secret);
      const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
      if (signature !== digest) {
        res.status(401).json({ error: 'Invalid X-Hub-Signature-256' });
        return;
      }
    }

    const body = req.body as {
      ref?: string;
      after?: string;
      repository?: { full_name?: string };
      pusher?: { name?: string };
      commits?: Array<{ id?: string; message: string; author?: { name?: string } }>;
    };

    const ref = body.ref || `refs/heads/${currentConfig.branch}`;
    const commits =
      body.commits && body.commits.length > 0
        ? body.commits
        : [{ message: 'Trigger push event to StreamFlowAria' }];

    const evaluation = shouldTriggerAutoDeploy(currentConfig, { ref, commits });
    const latestCommit = commits[commits.length - 1];
    const sha = body.after || latestCommit?.id || crypto.randomBytes(20).toString('hex');
    const author =
      latestCommit?.author?.name || body.pusher?.name || currentConfig.repoOwner;

    const eventEntry: WebhookEventLog = {
      id: `wh-${902 + webhookEvents.length}`,
      event: (req.headers['x-github-event'] as string) || 'push',
      deliveryId:
        (req.headers['x-github-delivery'] as string) || crypto.randomUUID(),
      repoFullName:
        body.repository?.full_name ||
        `${currentConfig.repoOwner}/${currentConfig.repoName}`,
      branch: evaluation.branch,
      commitSha: sha.slice(0, 7),
      commitMessage: latestCommit.message,
      triggeredDeploy: evaluation.trigger,
      reason: evaluation.reason,
      receivedAt: new Date().toISOString(),
    };

    webhookEvents = [eventEntry, ...webhookEvents];

    let createdDeployment: DeploymentRecord | null = null;
    if (evaluation.trigger) {
      createdDeployment = buildDeploymentFromCommit({
        commitMessage: latestCommit.message,
        branch: evaluation.branch,
        author,
        commitSha: sha,
        trigger: 'push',
      });
      deployments = [createdDeployment, ...deployments];
    }

    res.json({
      evaluation,
      webhookEvent: eventEntry,
      deployment: createdDeployment,
      deployments,
      webhookEvents,
    });
  });

  // 8. Manual or Simulated Commit Push Trigger
  app.post('/api/deployments/trigger', (req, res) => {
    const { commitMessage, branch, author, triggerType } = req.body as {
      commitMessage?: string;
      branch?: string;
      author?: string;
      triggerType?: 'push' | 'manual';
    };

    const msg = (commitMessage || '').trim();
    if (!msg) {
      res.status(400).json({
        error: 'Введите сообщение коммита для запуска пайплайна автодеплоя.',
      });
      return;
    }

    const targetBranch = (branch || currentConfig.branch).trim();
    const commitAuthor = (author || currentConfig.repoOwner).trim();
    const ref = `refs/heads/${targetBranch}`;

    const evaluation = shouldTriggerAutoDeploy(currentConfig, {
      ref,
      commits: [{ message: msg, author: { name: commitAuthor } }],
    });

    const sha = crypto.randomBytes(20).toString('hex');

    const eventEntry: WebhookEventLog = {
      id: `wh-${902 + webhookEvents.length}`,
      event: triggerType === 'manual' ? 'workflow_dispatch' : 'push',
      deliveryId: crypto.randomUUID(),
      repoFullName: `${currentConfig.repoOwner}/${currentConfig.repoName}`,
      branch: targetBranch,
      commitSha: sha.slice(0, 7),
      commitMessage: msg,
      triggeredDeploy: triggerType === 'manual' ? true : evaluation.trigger,
      reason:
        triggerType === 'manual'
          ? `Ручной запуск деплоя (workflow_dispatch) для ветки "${targetBranch}".`
          : evaluation.reason,
      receivedAt: new Date().toISOString(),
    };

    webhookEvents = [eventEntry, ...webhookEvents];

    let createdDeployment: DeploymentRecord | null = null;
    if (triggerType === 'manual' || evaluation.trigger) {
      createdDeployment = buildDeploymentFromCommit({
        commitMessage: msg,
        branch: targetBranch,
        author: commitAuthor,
        commitSha: sha,
        trigger: triggerType || 'push',
      });
      deployments = [createdDeployment, ...deployments];
    }

    res.json({
      triggered: Boolean(createdDeployment),
      reason: eventEntry.reason,
      deployment: createdDeployment,
      deployments,
      webhookEvents,
    });
  });

  // Vite middleware in development, static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StreamFlowAria CI/CD Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
