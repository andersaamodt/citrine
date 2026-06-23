'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

add('exports only the lowercase namespaced runtime API', () => {
  assert.deepStrictEqual(Object.keys(citrine).sort(), ['nostr', 'web', 'zaps']);
  assert.strictEqual(typeof citrine.nostr.getNip07Signer, 'function');
  assert.strictEqual(typeof citrine.nostr.signAuthChallenge, 'function');
  assert.strictEqual(typeof citrine.zaps.createZapInvoice, 'function');
  assert.strictEqual(typeof citrine.zaps.createZapFlow, 'function');
  assert.strictEqual(typeof citrine.web.ensureNostrLoginDialog, 'function');
  assert.strictEqual(typeof citrine.web.renderNostrRecommendations, 'function');
  assert.strictEqual(citrine.getNip07Signer, undefined);
  assert.strictEqual(citrine.createZapInvoice, undefined);
  assert.strictEqual(citrine.ensureNostrLoginDialog, undefined);
  assert.strictEqual(citrine.legacy, undefined);
});

add('browser global uses only lowercase citrine', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'citrine-nostr-web.js'), 'utf8');
  const context = { Object, Error, Promise, URL, URLSearchParams, TextEncoder, TextDecoder, setTimeout, clearTimeout };
  context.globalThis = context;
  context.self = context;
  vm.runInNewContext(source, context, { filename: 'citrine-nostr-web.js' });
  assert(context.citrine);
  assert.strictEqual(context.Citrine, undefined);
  assert.strictEqual(context.CitrineNostrWeb, undefined);
  assert.strictEqual(typeof context.citrine.nostr.getNip07Signer, 'function');
  assert.strictEqual(typeof context.citrine.zaps.requestZapInvoice, 'function');
  assert.strictEqual(typeof context.citrine.web.nostrLoginDialogHtml, 'function');
  assert.strictEqual(context.citrine.getNip07Signer, undefined);
  assert.strictEqual(context.citrine.requestZapInvoice, undefined);
  assert.strictEqual(context.citrine.nostrLoginDialogHtml, undefined);
});

add('buildNostrConnectUri keeps app-neutral NIP-46 parameters', () => {
  const uri = citrine.nostr.buildNostrConnectUri({
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
  const result = await citrine.nostr.withTimedOutRetry(() => {
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
  await assert.rejects(citrine.nostr.withTimedOutRetry(() => {
    attempts += 1;
    throw new Error('Signer rejected request.');
  }, {
    wait: () => Promise.resolve()
  }), /Signer rejected/);
  assert.strictEqual(attempts, 1);
});

add('createAuthEventTemplate builds signer-neutral Nostr auth events', () => {
  const event = citrine.nostr.createAuthEventTemplate({
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

add('signAuthChallenge signs shared auth templates', async () => {
  const signed = await citrine.nostr.signAuthChallenge({
    getPublicKey: () => Promise.resolve('A'.repeat(64)),
    signEvent: (event) => Promise.resolve(Object.assign({}, event, { id: 'signed-auth' }))
  }, {
    challenge: 'challenge-1',
    domain: 'example.test',
    origin: 'https://example.test',
    content: 'login'
  });
  assert.strictEqual(signed.pubkey, 'a'.repeat(64));
  assert.strictEqual(signed.event.id, 'signed-auth');
  assert(signed.event.tags.some((tag) => tag[0] === 'challenge' && tag[1] === 'challenge-1'));
});

add('normalizeNostrPubkey accepts hex and npub through optional tools', () => {
  assert.strictEqual(citrine.nostr.normalizeNostrPubkey('A'.repeat(64)), 'a'.repeat(64));
  const tools = {
    nip19: {
      decode: (value) => {
        assert.strictEqual(value, 'npub1example');
        return { type: 'npub', data: 'B'.repeat(64) };
      }
    }
  };
  assert.strictEqual(citrine.nostr.normalizeNostrPubkey('npub1example', tools), 'b'.repeat(64));
  assert.strictEqual(citrine.nostr.normalizeNostrPubkey('npub1example'), '');
});

add('nostr login dialog owns shared modal markup', () => {
  const html = citrine.web.nostrLoginDialogHtml({ title: 'Log in' });
  assert(html.includes('id="auth-modal"'));
  assert(html.includes('id="auth-nip46-qr"'));
  assert(html.includes('id="auth-login-apps"'));
  assert(html.includes('Recommended Apps'));
  assert(!html.includes('Open Amber'));
});

add('recommendations keep Amber as Android login recommendation without Amber-specific login copy', () => {
  const android = citrine.web.nostrLoginRecommendation('phone', 'android');
  assert.strictEqual(android.note, 'Recommended for Android Nostr Connect login.');
  assert.strictEqual(android.apps[0].name, 'Amber');
  assert(android.apps[0].stores.some((store) => store.source === 'F-Droid'));
  const helper = citrine.web.signInHelperMessage('phone');
  assert(helper.includes('Your Nostr public key is your account'));
  assert(helper.includes('Connect Nostr with the link or QR'));
  assert(!helper.includes('Amber'));
});

add('createNip46Client retries account pubkey after connect ack settle window', async () => {
  let attempts = 0;
  const statuses = [];
  const client = citrine.nostr.createNip46Client({
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

add('createNip46Client exposes launch and reset controls', () => {
  const client = citrine.nostr.createNip46Client({ relays: ['wss://relay.example'] });
  assert.strictEqual(client.setLaunchPending(true), true);
  assert.strictEqual(client.state().launchPending, true);
  client.resetPairing();
  assert.strictEqual(client.state().active, false);
  assert.strictEqual(client.state().launchPending, false);
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
  assert.strictEqual(citrine.nostr.hasNostrTools(target), true);
  assert.strictEqual(citrine.nostr.hasNostrTools({}), false);
  const resolved = await citrine.nostr.waitForNostrTools({ target });
  assert.strictEqual(resolved, tools);
});

add('createSharedNostrSigner normalizes browser and phone signer access', async () => {
  const browserEvent = { kind: 1, tags: [], content: 'hello' };
  const browserApi = citrine.nostr.createSharedNostrSigner({
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

  const phoneApi = citrine.nostr.createSharedNostrSigner({
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
  assert.strictEqual(
    citrine.zaps.bech32Encode('lnurl', 'https://wallet.example/.well-known/lnurlp/alice'),
    'lnurl1dp68gurn8ghj7ampd3kx2apwv4uxzmtsd3jj7tnhv4kxctttdehhwm30d3h82unvwqhkzmrfvdjskx890f'
  );
  const lnurlInfo = {
    encodedLnurl: citrine.zaps.bech32Encode('lnurl', 'https://wallet.example/.well-known/lnurlp/alice'),
    nostrPubkey: 'd'.repeat(64)
  };
  const template = citrine.zaps.createZapRequestTemplate({
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

  const signed = await citrine.zaps.createSignedZapRequest({
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
  const result = await citrine.zaps.createZapInvoice({
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

add('NIP-55 helpers build callback URIs and parse signer returns', () => {
  const callback = citrine.nostr.buildNip55CallbackUrl('https://app.example/play?x=1#old=1');
  assert.strictEqual(callback, 'https://app.example/play#nostrSignerResult=');
  const uri = citrine.nostr.buildNip55Uri({
    type: 'get_public_key',
    params: { appName: 'Citrine', callbackUrl: callback, permissions: [] }
  });
  assert(uri.startsWith('nostrsigner:?'));
  assert(uri.includes('type=get_public_key'));
  assert(uri.includes('callbackUrl='));
  const parsed = citrine.nostr.parseNip55Callback('https://app.example/play?package=x#nostrSignerResult=' + 'c'.repeat(64));
  assert.strictEqual(parsed.present, true);
  assert.strictEqual(parsed.rejected, false);
  assert.strictEqual(parsed.result, 'c'.repeat(64));
  assert.strictEqual(parsed.cleanUrl, '/play');
});

add('WebLN copy and zap flow helpers stay headless', async () => {
  const payments = [];
  const target = {
    webln: {
      enable: () => Promise.resolve(),
      sendPayment: (invoice) => {
        payments.push(invoice);
        return Promise.resolve({ preimage: 'ok' });
      }
    },
    navigator: {
      clipboard: {
        writeText: (text) => Promise.resolve(text)
      }
    }
  };
  assert.deepStrictEqual(await citrine.zaps.payLightningInvoiceWithWebLN('lnbc1test', target), { preimage: 'ok' });
  assert.deepStrictEqual(payments, ['lnbc1test']);
  assert.strictEqual(await citrine.zaps.copyTextToClipboard('lnbc1test', target), 'lnbc1test');
  const flow = citrine.zaps.createZapFlow({ target });
  assert.deepStrictEqual(await flow.payInvoice('lnbc1again'), { preimage: 'ok' });
  assert.strictEqual(await flow.copyInvoice('lnbc1again'), 'lnbc1again');
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
  const unbind = citrine.nostr.bindSignerReturnRefresh(target, (reason) => calls.push(reason));
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
