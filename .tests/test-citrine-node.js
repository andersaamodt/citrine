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

add('createAuthEventTemplate builds signer-neutral Nostr auth events', () => {
  const event = citrine.createAuthEventTemplate({
    challenge: 'abc123',
    origin: 'https://example.test',
    domain: 'example.test',
    action: 'revoke_all',
    pubkey: 'B'.repeat(64),
    createdAt: 1234567890
  });
  assert.strictEqual(event.kind, 22242);
  assert.strictEqual(event.created_at, 1234567890);
  assert.strictEqual(event.content, '');
  assert.strictEqual(event.pubkey, 'b'.repeat(64));
  assert.deepStrictEqual(event.tags, [
    ['challenge', 'abc123'],
    ['origin', 'https://example.test'],
    ['domain', 'example.test'],
    ['action', 'revoke_all']
  ]);
});

add('nostr login dialog owns shared modal markup', () => {
  const html = citrine.nostrLoginDialogHtml({ title: 'Log in' });
  assert(html.includes('id="auth-modal"'));
  assert(html.includes('id="auth-nip46-qr"'));
  assert(html.includes('id="auth-login-apps"'));
  assert(html.includes('Recommended Apps'));
  assert(!html.includes('Open Amber'));
});

add('recommendations keep Amber as Android login recommendation without Amber-specific login copy', () => {
  const android = citrine.nostrLoginRecommendation('phone', 'android');
  assert.strictEqual(android.note, 'Recommended for Android Nostr Connect login.');
  assert.strictEqual(android.apps[0].name, 'Amber');
  assert(android.apps[0].stores.some((store) => store.source === 'F-Droid'));
  const helper = citrine.signInHelperMessage('phone');
  assert(helper.includes('Your Nostr public key is your account'));
  assert(helper.includes('Connect Nostr with the link or QR'));
  assert(!helper.includes('Amber'));
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

add('hasNostrTools and waitForNostrTools expose shared readiness checks', async () => {
  const tools = {
    generateSecretKey: () => new Uint8Array(32),
    getPublicKey: () => 'a'.repeat(64),
    finalizeEvent: (event) => event,
    nip04: {
      encrypt: () => Promise.resolve('cipher'),
      decrypt: () => Promise.resolve('{}')
    },
    SimplePool: function SimplePool() {}
  };
  const target = { NostrTools: tools };
  assert.strictEqual(citrine.hasNostrTools(target), true);
  assert.strictEqual(citrine.hasNostrTools({}), false);
  const resolved = await citrine.waitForNostrTools({ target });
  assert.strictEqual(resolved, tools);
});

add('createSharedNostrSigner normalizes browser and phone signer access', async () => {
  const browserEvent = { kind: 1, tags: [], content: 'hello' };
  const browserApi = citrine.createSharedNostrSigner({
    target: {
      nostr: {
        getPublicKey: () => Promise.resolve('A'.repeat(64)),
        signEvent: (event) => Promise.resolve(Object.assign({}, event, { id: 'browser' }))
      }
    }
  });
  assert.strictEqual(await browserApi.getPublicKey(), 'a'.repeat(64));
  assert.strictEqual((await browserApi.signEvent(browserEvent)).id, 'browser');
  assert.deepStrictEqual(await browserApi.getStatus(), { available: true, method: 'browser', pubkey: 'a'.repeat(64) });

  const phoneApi = citrine.createSharedNostrSigner({
    target: {},
    nip46Client: {
      state: () => ({ signerPubkey: 'b'.repeat(64), accountPubkey: 'c'.repeat(64) }),
      ensurePairing: () => Promise.resolve(),
      getAccountPubkey: () => Promise.resolve('c'.repeat(64)),
      sendRpc: (method, params) => {
        assert.strictEqual(method, 'sign_event');
        return Promise.resolve(JSON.stringify(Object.assign(JSON.parse(params[0]), { id: 'phone' })));
      }
    }
  });
  assert.strictEqual(await phoneApi.getPublicKey(), 'c'.repeat(64));
  assert.strictEqual((await phoneApi.signEvent(browserEvent)).id, 'phone');
  assert.deepStrictEqual(await phoneApi.getStatus(), { available: true, method: 'nip46', pubkey: 'c'.repeat(64) });
});

add('zap helpers build NIP-57 requests and unsigned invoices', async () => {
  const lnurlInfo = {
    encodedLnurl: citrine.bech32Encode('lnurl', 'https://wallet.example/.well-known/lnurlp/alice'),
    nostrPubkey: 'd'.repeat(64)
  };
  const template = citrine.createZapRequestTemplate({
    lnurlInfo,
    zapConfig: { relays: ['wss://relay.example'] },
    target: { eventId: 'e'.repeat(64), kind: 30023 },
    amountMsats: 100000,
    note: 'thanks',
    createdAt: 123
  });
  assert.strictEqual(template.kind, 9734);
  assert.deepStrictEqual(template.tags[0], ['relays', 'wss://relay.example']);
  assert(template.tags.some((tag) => tag[0] === 'p' && tag[1] === 'd'.repeat(64)));
  assert(template.tags.some((tag) => tag[0] === 'e' && tag[1] === 'e'.repeat(64)));
  assert(template.tags.some((tag) => tag[0] === 'k' && tag[1] === '30023'));

  const signed = await citrine.createSignedZapRequest({
    signer: {
      getPublicKey: () => Promise.resolve('f'.repeat(64)),
      signEvent: (event) => Promise.resolve(Object.assign({}, event, { id: 'signed' }))
    },
    lnurlInfo,
    zapConfig: { relays: ['wss://relay.example'] },
    amountMsats: 100000
  });
  assert.strictEqual(signed.pubkey, 'f'.repeat(64));
  assert.strictEqual(signed.id, 'signed');
});

add('createZapInvoice fetches LNURL metadata and callback invoices', async () => {
  const calls = [];
  const result = await citrine.createZapInvoice({
    lud16: 'alice@wallet.example',
    sats: 100,
    note: 'nice post',
    fetch: (url) => {
      calls.push(url);
      if (url.includes('/.well-known/lnurlp/alice')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify({
            allowsNostr: true,
            nostrPubkey: 'a'.repeat(64),
            callback: '/lnurl/callback',
            minSendable: 1000,
            maxSendable: 1000000,
            commentAllowed: 20
          }))
        });
      }
      assert(url.includes('amount=100000'));
      assert(url.includes('comment=nice+post'));
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ pr: 'lnbc1invoice' }))
      });
    }
  });
  assert.strictEqual(result.invoice, 'lnbc1invoice');
  assert.strictEqual(result.signed, false);
  assert.strictEqual(calls.length, 2);
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
