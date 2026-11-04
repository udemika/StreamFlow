import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateRepoConfig,
  shouldTriggerAutoDeploy,
  generateGithubActionsYaml,
  computeDeploymentMetrics,
  type DeployConfig,
  type DeploymentRecord,
} from './cicdLogic';

const sampleConfig: DeployConfig = {
  repoOwner: 'aksarus',
  repoName: 'StreamFlowAria',
  branch: 'main',
  targetPlatform: 'cloud-run',
  nodeVersion: '22',
  installCommand: 'npm ci',
  testCommand: 'npm run lint',
  buildCommand: 'npm run build',
  autoDeployOnPush: true,
  runTestsBeforeDeploy: true,
  cancelInProgress: true,
  cloudRunService: 'streamflow-aria',
  cloudRunRegion: 'europe-west2',
  webhookUrl: 'https://ais-pre-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app/api/webhooks/github',
};

test('validateRepoConfig accepts valid StreamFlowAria config and rejects empty fields', () => {
  const validRes = validateRepoConfig(sampleConfig);
  assert.equal(validRes.valid, true);
  assert.deepEqual(validRes.errors, {});

  const invalidRes = validateRepoConfig({
    ...sampleConfig,
    repoOwner: '',
    repoName: 'Invalid Repo Name!',
    branch: '',
  });
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.errors.repoOwner);
  assert.ok(invalidRes.errors.repoName);
  assert.ok(invalidRes.errors.branch);
});

test('shouldTriggerAutoDeploy evaluates branch, autoDeploy flag, and [skip ci] tags', () => {
  const okPush = shouldTriggerAutoDeploy(sampleConfig, {
    ref: 'refs/heads/main',
    commits: [{ message: 'feat: optimize audio streaming latency in StreamFlowAria' }],
  });
  assert.equal(okPush.trigger, true);
  assert.equal(okPush.branch, 'main');

  const wrongBranch = shouldTriggerAutoDeploy(sampleConfig, {
    ref: 'refs/heads/feature/experimental',
    commits: [{ message: 'wip' }],
  });
  assert.equal(wrongBranch.trigger, false);
  assert.equal(wrongBranch.branch, 'feature/experimental');

  const skippedCommit = shouldTriggerAutoDeploy(sampleConfig, {
    ref: 'refs/heads/main',
    commits: [{ message: 'docs: update readme [skip ci]' }],
  });
  assert.equal(skippedCommit.trigger, false);

  const disabledConfig = shouldTriggerAutoDeploy(
    { ...sampleConfig, autoDeployOnPush: false },
    { ref: 'refs/heads/main', commits: [{ message: 'feat: new release' }] }
  );
  assert.equal(disabledConfig.trigger, false);
});

test('generateGithubActionsYaml includes repo name, branch, and Cloud Run deployment steps', () => {
  const yaml = generateGithubActionsYaml(sampleConfig);
  assert.ok(yaml.includes('name: StreamFlowAria Auto-Deploy on Commit'));
  assert.ok(yaml.includes('- main'));
  assert.ok(yaml.includes('service: streamflow-aria'));
  assert.ok(yaml.includes('region: europe-west2'));
  assert.ok(yaml.includes('run: npm run lint'));
});

test('computeDeploymentMetrics calculates accurate success rate and average duration', () => {
  const records: DeploymentRecord[] = [
    {
      id: 'dep-1',
      commitSha: '9f8e7d6c5b4a',
      commitMessage: 'feat: init StreamFlowAria pipeline',
      author: 'aksarus',
      branch: 'main',
      trigger: 'push',
      status: 'success',
      targetPlatform: 'cloud-run',
      startedAt: '2026-11-04T06:40:00Z',
      durationSec: 42,
      environmentUrl: 'https://ais-pre-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app',
      stages: [],
    },
    {
      id: 'dep-2',
      commitSha: '1a2b3c4d5e6f',
      commitMessage: 'fix: broken import',
      author: 'aksarus',
      branch: 'main',
      trigger: 'push',
      status: 'failed',
      targetPlatform: 'cloud-run',
      startedAt: '2026-11-04T06:20:00Z',
      durationSec: 18,
      environmentUrl: 'https://ais-pre-dglr2bdszxh6acmmhguw56-907657742145.europe-west2.run.app',
      stages: [],
    },
  ];

  const metrics = computeDeploymentMetrics(records);
  assert.equal(metrics.total, 2);
  assert.equal(metrics.successCount, 1);
  assert.equal(metrics.failedCount, 1);
  assert.equal(metrics.successRate, 50);
  assert.equal(metrics.avgDurationSec, 30);
  assert.equal(metrics.latestSha, '9f8e7d6');
});
