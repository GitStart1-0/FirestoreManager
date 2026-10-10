import { test } from 'node:test';
import assert from 'node:assert/strict';
import config from './managerAppCheckConfig.json';
import { managerAppCheckSiteKey } from './managerAppCheckConfig';
test('registered preview gets public configuration without editing saved connections', () => {
  assert.equal(managerAppCheckSiteKey(config.appId, config.allowedDomains[0]), config.siteKey);
  for (const host of ['localhost', '127.0.0.1', 'another.run.app']) assert.equal(managerAppCheckSiteKey(config.appId, host), undefined);
  assert.equal(managerAppCheckSiteKey('another-app', config.allowedDomains[0]), undefined);
  assert.equal(managerAppCheckSiteKey('another-app', 'another.run.app', ' explicit-key '), 'explicit-key');
});
