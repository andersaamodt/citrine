'use strict';

const assert = require('assert');
const citrine = require('../src/citrine-nostr-web.js');

async function test(name, fn) {
  try {
    await fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n${err && err.stack ? err.stack : err}\n`);
    process.exitCode = 1;
  }
}

const tests = [];
function add(name, fn) {
  tests.push([name, fn]);
}

add('buildNostrConnectUri keeps app-neutral NIP-46 parameters', () => {
  const uri = citrine.buildNostrConnectUri({
    appPubkey: 'a'.repeat(64),
    pairSecret: 'secret',
    relays: ['wss://relay.example', 'http://bad.example'],
    name: 'Citrine',
    metadata: { name: 'Citrine', url: 'https://example.test' },
    perms: ['get_public_key', 'sign_event:22242']
  });
  assert(uri.startsWith('nostrconnect://' + 'a'.repeat(64) + '?'));
  assert(uri.includes('relay=wss%3A%2F%2Frelay.example'));
  assert(uri.includes('secret=secret'));
  assert(uri.includes('perms=get_public_key%2Csign_event%3A22242'));
  assert(!uri.includes('package='));
});

add('withTimedOutRetry retries timed out failures only', async () => {
  let attempts = 0;
  const waits = [];
  const result = await citrine.withTimedOutRetry(() => {
    attempts += 1;
    if (attempts < 3) throw new Error('Phone signer timed out.');
    return 'done';
  }, {
    delays: [10, 20, 30],
    wait: (delay) => {
      waits.push(delay);
      return Promise.resolve();
    }
  });
  assert.strictEqual(result, 'done');
  assert.strictEqual(attempts, 3);
  assert.deepStrictEqual(waits, [10, 20]);
});

add('withTimedOutRetry does not retry unrelated errors', async () => {
  let attempts = 0;
  await assert.rejects(citrine.withTimedOutRetry(() => {
    attempts += 1;
    throw new Error('Signer rejected request.');
  }, {
    wait: () => Promise.resolve()
  }), /Signer rejected/);
  assert.strictEqual(attempts, 1);
});

add('createNip46Client retries account pubkey after connect ack settle window', async () => {
  let attempts = 0;
  const statuses = [];
  const client = citrine.createNip46Client({
    relays: ['wss://relay.example'],
    retryDelays: [1, 2, 3],
    wait: () => Promise.resolve(),
    onStatus: (event) => statuses.push(event),
    rpcRequest: (method) => {
      assert.strictEqual(method, 'get_public_key');
      attempts += 1;
      if (attempts < 3) return Promise.reject(new Error('Phone signer timed out.'));
      return Promise.resolve('b'.repeat(64));
    }
  });
  client.state().active = true;
  client.state().signerPubkey = 'c'.repeat(64);
  const pubkey = await client.getAccountPubkeyWithRetry({ forceRefresh: true });
  assert.strictEqual(pubkey, 'b'.repeat(64));
  assert.strictEqual(attempts, 3);
  assert.deepStrictEqual(statuses.map((event) => event.type), ['retry', 'retry']);
});

add('bindSignerReturnRefresh listens to pageshow focus and visible return', () => {
  const listeners = {};
  const docListeners = {};
  const target = {
    document: {
      hidden: false,
      addEventListener: (name, fn) => { docListeners[name] = fn; },
      removeEventListener: (name) => { delete docListeners[name]; }
    },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    removeEventListener: (name) => { delete listeners[name]; }
  };
  const calls = [];
  const unbind = citrine.bindSignerReturnRefresh(target, (reason) => calls.push(reason));
  listeners.pageshow();
  listeners.focus();
  docListeners.visibilitychange();
  assert.deepStrictEqual(calls, ['pageshow', 'focus', 'visibility']);
  unbind();
  assert.deepStrictEqual(Object.keys(listeners), []);
  assert.deepStrictEqual(Object.keys(docListeners), []);
});

(async () => {
  for (const [name, fn] of tests) {
    await test(name, fn);
    if (process.exitCode) process.exit(process.exitCode);
  }
})();
