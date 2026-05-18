import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { requireAdminToken } from '../src/routes/adminAuth';

describe('requireAdminToken', () => {
  it('rejects sync requests when an admin token is configured but absent', () => {
    const middleware = requireAdminToken('secret');
    let statusCode = 200;
    let body: unknown;

    middleware(
      { header: () => undefined },
      {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(payload: unknown) {
          body = payload;
        },
      },
      () => assert.fail('next should not be called')
    );

    assert.equal(statusCode, 401);
    assert.deepEqual(body, { error: 'Unauthorized' });
  });

  it('allows sync requests with the configured bearer token', () => {
    const middleware = requireAdminToken('secret');
    let calledNext = false;

    middleware(
      { header: () => 'Bearer secret' },
      {
        status() {
          assert.fail('status should not be called');
          return this;
        },
        json() {
          assert.fail('json should not be called');
        },
      },
      () => {
        calledNext = true;
      }
    );

    assert.equal(calledNext, true);
  });
});
