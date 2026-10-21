const http = require('node:http');
const Blockchain = require('./src/blockchain');
const Transaction = require('./src/transaction');
const Wallet = require('./src/wallet');

const blockchain = new Blockchain();

// Create sample data for the explorer.
blockchain.mineBlock('demo-miner', {
  message: 'First demo block',
});

blockchain.addBlock({
  message: 'Second demo block',
});

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Blockchain Explorer</title>
  <style>
    body {
      margin: 0; padding: 20px; font-family: Arial, sans-serif;
      background: #101827; color: #f1f5f9;
    }
    h1 { color: #60a5fa; }
    .stats { display:flex; flex-wrap:wrap; gap:12px; margin:20px 0; }
    .card,.block {
      background:#1e293b; border:1px solid #334155; border-radius:12px;
      padding:16px; margin-bottom:14px; overflow-wrap:anywhere;
    }
    .stats .card { flex:1; min-width:110px; }
    .number { font-size:25px; font-weight:bold; }
    .hash { color:#93c5fd; font-size:13px; overflow-wrap:anywhere; }
    .label { color:#94a3b8; }
    button {
      background:#2563eb; color:white; padding:12px 18px; border:0;
      border-radius:8px; font-size:16px; cursor:pointer;
    }
    input {
      box-sizing:border-box; width:100%; padding:12px; margin:8px 0;
      background:#0f172a; color:#f1f5f9; border:1px solid #475569;
      border-radius:8px;
    }
    .valid { color:#4ade80; }
    .error { color:#f87171; }
    .muted { color:#94a3b8; }
    .section { margin-top:28px; }
    .transaction { border-bottom:1px solid #334155; padding:12px 0; }
    .transaction:last-child { border-bottom:0; }
  </style>
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
    <h2>Wallet balance checker</h2>
    <div class="card">
      <label for="address">Public wallet address</label>
      <input id="address" autocomplete="off" placeholder="Paste a public wallet address">
      <button id="balanceButton" type="button">Check balance</button>
      <p id="balanceResult" aria-live="polite"></p>
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

  <script>
    const byId = id => document.getElementById(id);

    function addText(parent, tag, text, className) {
      const el = document.createElement(tag);
      el.textContent = String(text);
      if (className) el.className = className;
      parent.appendChild(el);
      return el;
    }

    function transactionList(chain) {
      const root = byId('transactions');
      root.replaceChildren();
      let count = 0;

      [...chain].reverse().forEach(block => {
        const items = Array.isArray(block.data) ? block.data : [block.data];
        items.forEach(tx => {
          if (!tx || typeof tx !== 'object' ||
              typeof tx.from !== 'string' ||
              typeof tx.to !== 'string' ||
              !Number.isFinite(tx.amount)) return;

          count++;
          const item = document.createElement('div');
          item.className = 'transaction';
          addText(item, 'strong', 'Block #' + block.index);
          addText(item, 'p', 'From: ' + tx.from);
          addText(item, 'p', 'To: ' + tx.to);
          addText(item, 'p', 'Amount: ' + tx.amount + ' coins');
          addText(item, 'p', 'Time: ' + block.timestamp, 'muted');
          root.appendChild(item);
        });
      });

      byId('txCount').textContent = count;
      if (!count) addText(root, 'p', 'No mined transactions found yet.', 'muted');
    }

    async function loadChain() {
      const output = byId('blocks');
      try {
        const response = await fetch('/api/chain', { cache: 'no-store' });
        if (!response.ok) throw new Error('Could not load blockchain');
        const result = await response.json();
        const chain = Array.isArray(result) ? result : result.chain;
        if (!Array.isArray(chain)) throw new Error('Invalid blockchain response');

        byId('count').textContent = chain.length;
        output.replaceChildren();

        chain.forEach(block => {
          const card = document.createElement('section');
          card.className = 'block';
          addText(card, 'h3', 'Block #' + block.index);

          const details = [
            ['Timestamp', block.timestamp],
            ['Previous hash', block.previousHash],
            ['Block hash', block.hash],
            ['Data', JSON.stringify(block.data)],
            ['Mining reward', block.reward
              ? block.reward.amount + ' coins to ' + block.reward.to
              : 'None']
          ];

          details.forEach(([label, value]) => {
            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = label + ': ';
            p.appendChild(strong);
            p.appendChild(document.createTextNode(String(value)));
            if (label.toLowerCase().includes('hash')) p.className = 'hash';
            card.appendChild(p);
          });
          output.appendChild(card);
        });

        const status = byId('status');
        status.textContent = result.valid ? 'VALID' : 'INVALID';
        status.className = 'number ' + (result.valid ? 'valid' : 'error');
        transactionList(chain);
        byId('updated').textContent = 'Last refreshed: ' + new Date().toLocaleTimeString();
      } catch (error) {
        output.textContent = error.message;
        byId('status').textContent = 'Unavailable';
        byId('status').className = 'number error';
      }
    }

    async function checkBalance() {
      const address = byId('address').value.trim();
      const output = byId('balanceResult');
      output.textContent = '';

      if (!address) {
        output.textContent = 'Enter a wallet address first.';
        output.className = 'error';
        return;
      }

      try {
        const response = await fetch('/api/balance?address=' + encodeURIComponent(address),
          { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Balance lookup failed');
        output.textContent = 'Balance: ' + result.balance + ' coins';
        output.className = 'valid';
      } catch (error) {
        output.textContent = error.message;
        output.className = 'error';
      }
    }

    byId('refreshButton').addEventListener('click', loadChain);
    byId('balanceButton').addEventListener('click', checkBalance);
    byId('address').addEventListener('keydown', event => {
      if (event.key === 'Enter') checkBalance();
    });

    loadChain();
    setInterval(loadChain, 10000);
  </script>
</body>
</html>`;


const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.split('?')[0] === '/api/blocks') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;

      if (body.length > 10000) {
        req.destroy();
      }
    });

    req.on('end', () => {
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

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 20000) req.destroy();
    });

    req.on('end', () => {
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

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        const block = blockchain.pendingTransactions.length > 0
          ? blockchain.minePendingTransactions(payload && payload.minerAddress)
          : blockchain.mineBlock(
              payload && payload.minerAddress,
              { message: 'Block mined through API' }
            );

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

  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(page);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(3000, '127.0.0.1', () => {
  console.log('Blockchain Explorer running at http://127.0.0.1:3000');
  console.log('Keep Termux running while you use the browser.');
});
