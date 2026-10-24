const http = require('node:http');
const Blockchain = require('./src/blockchain');
const Transaction = require('./src/transaction');
const Wallet = require('./src/wallet');

const blockchain = new Blockchain();
const Block = require('./src/block');
const fs = require('node:fs');
const path = require('node:path');

const chainFile = path.join(__dirname, 'blockchain-data.json');

function saveBlockchain() {
  const data = {
    chain: blockchain.chain,
    pendingTransactions: blockchain.pendingTransactions
  };

  const temporaryFile = chainFile + '.tmp';
  fs.writeFileSync(temporaryFile, JSON.stringify(data, null, 2), {
    mode: 0o600
  });
  fs.renameSync(temporaryFile, chainFile);
}

function loadBlockchain() {
  if (!fs.existsSync(chainFile)) return;

  const saved = JSON.parse(fs.readFileSync(chainFile, 'utf8'));

  if (!saved || !Array.isArray(saved.chain) || saved.chain.length === 0) {
    throw new Error('Saved blockchain file is invalid');
  }

  const restoreTransaction = item => {
    const transaction = new Transaction(item.from, item.to, item.amount);
    transaction.signature = item.signature;
    return transaction;
  };

  const restoredChain = saved.chain.map(item => {
    const block = new Block(
      item.index,
      item.timestamp,
      Array.isArray(item.data)
        ? item.data.map(restoreTransaction)
        : item.data,
      item.previousHash
    );

    block.reward = item.reward ?? null;
    block.nonce = item.nonce;
    block.hash = item.hash;
    return block;
  });

  const restoredPending = Array.isArray(saved.pendingTransactions)
    ? saved.pendingTransactions.map(restoreTransaction)
    : [];

  const previousChain = blockchain.chain;
  blockchain.chain = restoredChain;

  if (!blockchain.isChainValid()) {
    blockchain.chain = previousChain;
    throw new Error('Saved blockchain failed validation; refusing to load it');
  }

  blockchain.pendingTransactions = restoredPending;
  blockchain.rewardedBlocks = new Set(
    restoredChain.filter(block => block.reward).map(block => block.index)
  );
}

loadBlockchain();

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blockchain Explorer</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <h1>⛓ Blockchain Explorer</h1>
  <p class="label">Your local JavaScript blockchain</p>

  <div class="stats">
    <div class="card"><div class="label">Total blocks</div>
      <div class="number" id="count">...</div></div>
    <div class="card"><div class="label">Mining reward</div>
      <div class="number">50 coins</div></div>
    <div class="card"><div class="label">Chain status</div>
      <div class="number" id="status">...</div></div>
    <div class="card"><div class="label">Transactions</div>
      <div class="number" id="txCount">...</div></div>
  </div>

  <button id="refreshButton" type="button">Refresh explorer</button>
  <p class="muted" id="updated">Not yet refreshed</p>

  <div class="section">
    <h2>Mine a block</h2>
    <div class="card">
      <p class="muted">Mine a block and send the reward to your selected browser wallet.</p>
      <button id="mineButton" type="button">Mine Block</button>
      <p id="mineResult" aria-live="polite" class="muted"></p>
    </div>
  </div>

  <div class="section">
    <h2>Create a wallet</h2>
    <div class="card">
      <p class="muted">Generate a new demo wallet address.</p>
      <button id="createWalletButton" type="button">Create wallet</button>
      <p id="walletResult" aria-live="polite"></p>
      <hr>
      <h3>Import existing wallet</h3>
      <label for="privateKeyInput">Your saved private key (keep secret)</label>
      <textarea id="privateKeyInput" rows="3" autocomplete="off"
        placeholder="Paste your saved private key here"></textarea>
      <button id="importWalletButton" type="button">Import wallet</button>
      <p id="importWalletResult" aria-live="polite"></p>
    </div>
  </div>

  <div class="section">
    <h2>Wallet balance checker</h2>
    <div class="card">
      <label for="address">Public wallet address</label>
      <textarea id="address" rows="4" autocomplete="off" placeholder="Paste the full public key, including BEGIN/END lines"></textarea>
      <button id="balanceButton" type="button">Check balance</button>
      <p id="balanceResult" aria-live="polite"></p>
    </div>
  </div>

  <div class="section">
    <h2>Send coins</h2>
    <div class="card">
      <p class="muted">Send a digitally signed transaction from your saved browser wallet.</p>
      <label for="recipient">Recipient public key (address)</label>
      <textarea id="recipient" rows="4" autocomplete="off" placeholder="Paste recipient public key"></textarea>
      <label for="sendAmount">Amount</label>
      <input id="sendAmount" type="number" min="0.000001" step="any" placeholder="Enter amount">
      <button id="sendButton" type="button">Sign and send</button>
      <p id="sendResult" aria-live="polite"></p>
    </div>
  </div>

  <div class="section">
    <h2>Transaction history</h2>
    <div id="transactions" class="card">Loading transactions...</div>
  </div>

  <div class="section">
    <h2>Blocks</h2>
    <div id="blocks">Loading blockchain...</div>
  </div>

  <script src="/browser-wallet.js"></script>
  <script src="/js/explorer.js"></script>
</body>
</html>`;


const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/blocks') {
    let body = '';
    let receivedBytes = 0;
    let tooLarge = false;

    req.on('data', chunk => {
      if (tooLarge) return;
      receivedBytes += chunk.length;
      if (receivedBytes > 10000) {
        tooLarge = true;
        sendJSON(413, { error: 'Request body too large' });
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (tooLarge) return;
      try {
        const payload = JSON.parse(body);

        if (
          payload === null ||
          typeof payload !== 'object' ||
          Array.isArray(payload) ||
          !Object.prototype.hasOwnProperty.call(payload, 'data')
        ) {
          return sendJSON(400, {
            error: 'Request body must be JSON with a data field'
          });
        }

        const block = blockchain.addBlock(payload.data);
        saveBlockchain();
        return sendJSON(201, {
          message: 'Block added successfully',
          block
        });
      } catch (error) {
        if (!res.headersSent && !res.destroyed) {
          return sendJSON(400, { error: error.message || 'Invalid JSON' });
        }
      }
    });

    return;
  }

  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);

  function sendJSON(status, data) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    res.end(JSON.stringify(data, null, 2));
  }

  if (req.method === 'GET' && pathname === '/api/chain') {
    return sendJSON(200, {
      chain: blockchain.chain,
      valid: blockchain.isChainValid()
    });
  }

  if (req.method === 'GET' && pathname === '/api/blocks') {
    return sendJSON(200, blockchain.chain);
  }

  if (req.method === 'GET' && pathname === '/api/validate') {
    const valid = blockchain.isChainValid();
    return sendJSON(200, {
      valid,
      message: valid ? 'Blockchain is valid' : 'Blockchain is invalid'
    });
  }

  const blockMatch = pathname.match(/^\/api\/blocks\/(\d+)$/);
  if (req.method === 'GET' && blockMatch) {
    const index = Number(blockMatch[1]);
    const block = blockchain.chain.find(b => b.index === index);

    if (!block) {
      return sendJSON(404, { error: 'Block not found' });
    }

    return sendJSON(200, block);
  }

  if (req.method === 'GET' && pathname === '/api/wallet/public-address') {
    const fs = require('fs');
    const walletPath = require('path').join(__dirname, 'wallet.json');

    try {
      const savedWallet = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      return sendJSON(200, { address: savedWallet.address });
    } catch (error) {
      return sendJSON(404, { error: 'Saved wallet address not available' });
    }
  }

  if (req.method === 'GET' && pathname === '/api/balance') {
    const address = url.searchParams.get('address');

    if (!address) {
      return sendJSON(400, { error: 'Missing address parameter' });
    }

    return sendJSON(200, {
      address,
      balance: blockchain.getBalance(address)
    });
  }

  const balanceMatch = pathname.match(/^\/api\/balance\/([^/]+)$/);
  if (req.method === 'GET' && balanceMatch) {
    const address = balanceMatch[1];
    return sendJSON(200, {
      address,
      balance: blockchain.getBalance(address)
    });
  }


  // Create a demo wallet. Keep its private key secret.
  if (req.method === 'POST' && pathname === '/api/wallets') {
    const wallet = new Wallet();
    return sendJSON(201, {
      message: 'Demo wallet created. Keep your private key secret.',
      address: wallet.publicKey,
      publicKey: wallet.publicKey
    });
  }

  // Accept a digitally signed transaction and add it to the chain.
  if (req.method === 'POST' && pathname === '/api/transactions') {
    let body = '';
    let receivedBytes = 0;
    let tooLarge = false;

    req.on('data', chunk => {
      if (tooLarge) return;
      receivedBytes += chunk.length;
      if (receivedBytes > 20000) {
        tooLarge = true;
        sendJSON(413, { error: 'Request body too large' });
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (tooLarge) return;
      try {
        const payload = JSON.parse(body);

        if (!payload || typeof payload !== 'object' ||
            Array.isArray(payload)) {
          return sendJSON(400, { error: 'Expected a JSON object' });
        }

        const transaction = new Transaction(
          payload.from,
          payload.to,
          payload.amount
        );
        transaction.signature = payload.signature;

        const queuedTransaction = blockchain.addTransaction(transaction);
        saveBlockchain();

        return sendJSON(202, {
          message: 'Signed transaction accepted and queued for mining',
          transaction: queuedTransaction
        });
      } catch (error) {
        if (!res.headersSent && !res.destroyed) {
          return sendJSON(400, {
            error: error.message || 'Invalid transaction'
          });
        }
      }
    });

    return;
  }

  // Mine a block and award the configured mining reward.
  if (req.method === 'POST' && pathname === '/api/mine') {
    let body = '';
    let receivedBytes = 0;
    let tooLarge = false;

    req.on('data', chunk => {
      if (tooLarge) return;
      receivedBytes += chunk.length;
      if (receivedBytes > 10000) {
        tooLarge = true;
        sendJSON(413, { error: 'Request body too large' });
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (tooLarge) return;
      try {
        const payload = JSON.parse(body);

        const block = blockchain.pendingTransactions.length > 0
          ? blockchain.minePendingTransactions(payload && payload.minerAddress)
          : blockchain.mineBlock(
              payload && payload.minerAddress,
              { message: 'Block mined through API' }
            );

        saveBlockchain();

        return sendJSON(201, {
          message: 'Block mined successfully',
          reward: block.reward,
          block
        });
      } catch (error) {
        if (!res.headersSent && !res.destroyed) {
          return sendJSON(400, {
            error: error.message || 'Mining failed'
          });
        }
      }
    });

    return;
  }

  if (req.method === 'GET' && req.url.split('?')[0] === '/browser-wallet.js') {
    const fs = require('node:fs');
    const path = require('node:path');
    const file = path.join(__dirname, 'public', 'browser-wallet.js');
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(fs.readFileSync(file));
    return;
  }

  if (req.method === 'GET' && req.url.split('?')[0] === '/css/style.css') {
    const file = path.join(__dirname, 'public', 'css', 'style.css');
    res.writeHead(200, {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(fs.readFileSync(file));
    return;
  }

  if (req.method === 'GET' && req.url.split('?')[0] === '/js/explorer.js') {
    const file = path.join(__dirname, 'public', 'js', 'explorer.js');
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(fs.readFileSync(file));
    return;
  }

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

module.exports = { server, blockchain };

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  server.listen(port, '127.0.0.1', () => {
    console.log('Blockchain Explorer running at http://127.0.0.1:' + port);
    console.log('Keep Termux running while you use the browser.');
  });
}
