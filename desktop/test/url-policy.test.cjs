const { test } = require('node:test');
const assert = require('node:assert/strict');
const { websiteURL, canNavigate, isExternalURL } = require('../url-policy.cjs');

test('packaged configuration rejects insecure or credential-bearing URLs', () => {
  for (const value of [undefined, '', 'http://localhost:5173', 'http://buildx.example',
    'file:///etc/passwd', 'https://user:secret@buildx.example', 'https://buildx.example?token=x']) {
    assert.throws(() => websiteURL(value));
  }
  assert.equal(websiteURL('https://buildx.example').origin, 'https://buildx.example');
  assert.equal(websiteURL('http://localhost:5173', true).port, '5173');
  assert.throws(() => websiteURL('http://remote.example', true));
});

test('OAuth navigation permits exact origins but rejects lookalike hosts and native schemes', () => {
  const site = websiteURL('https://buildx.example');
  for (const url of ['https://buildx.example/login/callback?code=abc',
    'https://github.com/login/oauth/authorize?state=abc']) assert.ok(canNavigate(url, site));
  for (const url of ['https://buildx.example.attacker.test', 'https://github.com.attacker.test',
    'https://github.com@attacker.test', 'javascript:alert(1)', 'file:///tmp/example',
    'https://user@buildx.example', 'http://github.com', 'not a URL']) {
    assert.equal(canNavigate(url, site), false);
  }
});

test('external links never launch native URL handlers', () => {
  assert.ok(isExternalURL('https://github.com/nachiket7-dev/BuildX'));
  for (const url of ['file:///tmp/x', 'javascript:alert(1)', 'mailto:a@example.com',
    'http://example.com', 'https://user:pass@example.com', 'buildx://callback', 'invalid']) {
    assert.equal(isExternalURL(url), false);
  }
});
