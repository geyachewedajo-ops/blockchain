const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const Wallet = require('../src/wallet');
const Transaction = require('../src/transaction');

test('API rejects invalid signatures and processes valid signed transactions', async () => {
  const port = 3107;
  const serverPath = path.join(__dirname, '..', 'server.js');

  const child = spawn(process.execPath, [serverPath], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });

  const base = `http://127.0.0.1:${port}`;

  try {
    let ready = false;
    const deadline = Date.now() + 5000;

    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`Test server exited: ${logs}`);
      }

      try {
        const response = await fetch(`${base}/api/validate`);
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    assert.equal(ready, true, `Test server did not start: ${logs}`);

    const sender = new Wallet();
    const receiver = new Wallet();
    const miner = new Wallet();

    const invalid = await fetch(`${base}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender.publicKey,
        to: receiver.publicKey,
        amount: 1,
        signature: 'invalid-signature'
      })
    });

    assert.equal(invalid.status, 400);

    const funding = await fetch(`${base}/api/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minerAddress: sender.publicKey })
    });

    assert.equal(funding.status, 201);

    const transaction = new Transaction(
      sender.publicKey,
      receiver.publicKey,
      10
    );
    transaction.signTransaction(sender);

    const submitted = await fetch(`${base}/api/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: transaction.from,
        to: transaction.to,
        amount: transaction.amount,
        signature: transaction.signature
      })
    });

    assert.equal(submitted.status, 202);

    const mined = await fetch(`${base}/api/mine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ minerAddress: miner.publicKey })
    });

    assert.equal(mined.status, 201);
    const minedData = await mined.json();
    assert.equal(minedData.block.data.length, 1);
    assert.equal(minedData.block.data[0].amount, 10);

    const senderBalance = await fetch(
      `${base}/api/balance?address=${encodeURIComponent(sender.publicKey)}`
    );
    assert.equal((await senderBalance.json()).balance, 40);

    const receiverBalance = await fetch(
      `${base}/api/balance?address=${encodeURIComponent(receiver.publicKey)}`
    );
    assert.equal((await receiverBalance.json()).balance, 10);

    const validation = await fetch(`${base}/api/validate`);
    assert.equal(validation.status, 200);
    assert.equal((await validation.json()).valid, true);
  } finally {
    child.kill();
    await new Promise(resolve => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
    });
  }
});
