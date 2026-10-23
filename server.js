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

    async function createWallet() {
      const output = byId('walletResult');
      output.textContent = 'Creating wallet in this browser...';
      output.className = 'muted';

      try {
        if (!window.BrowserWallet) {
          throw new Error('Wallet library did not load. Refresh the page and try again.');
        }

        const wallet = window.BrowserWallet.create();

        // Save this demo wallet locally in this browser only.
        localStorage.setItem('blockchainWallet', JSON.stringify(wallet));

        byId('address').value = wallet.publicKey;
        output.replaceChildren();

        addText(output, 'p', 'Wallet created in your browser.');
        addText(output, 'label', 'Public key (address):');
        addText(output, 'textarea', wallet.publicKey);
        output.lastChild.readOnly = true;
        output.lastChild.rows = 4;

        addText(output, 'label', 'Private key — keep it secret:');
        addText(output, 'textarea', wallet.privateKey);
        output.lastChild.readOnly = true;
        output.lastChild.rows = 2;
        output.lastChild.autocomplete = 'off';

        addText(
          output,
          'p',
          'Save your private key somewhere secure. It is stored in this browser for this educational demo. Anyone who obtains it can control this wallet.',
          'muted'
        );

        output.className = 'valid';
      } catch (error) {
        output.textContent = error.message || 'Wallet creation failed.';
        output.className = 'error';
      }
    }

    function importWallet() {
      const input = byId('privateKeyInput');
      const output = byId('importWalletResult');
      output.textContent = '';
      output.className = 'muted';

      try {
        if (!window.BrowserWallet ||
            typeof window.BrowserWallet.importFromPrivateKey !== 'function') {
          throw new Error('Wallet import method is unavailable. Refresh after restarting the server.');
        }

        const privateKey = input.value.trim();
        if (!privateKey) throw new Error('Paste your saved private key first.');

        const wallet = window.BrowserWallet.importFromPrivateKey(privateKey);
        localStorage.setItem('blockchainWallet', JSON.stringify(wallet));
        byId('address').value = wallet.publicKey;
        input.value = '';

        output.textContent =
          'Wallet imported in this browser. Check its balance before sending coins.';
        output.className = 'valid';
      } catch (error) {
        output.textContent = error.message || 'Wallet import failed.';
        output.className = 'error';
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

    async function sendCoins() {
      const output = byId('sendResult');
      const button = byId('sendButton');
      output.textContent = '';
      output.className = 'muted';

      const recipient = byId('recipient').value.trim();
      const amount = Number(byId('sendAmount').value);

      if (!recipient) {
        output.textContent = 'Enter the recipient public key.';
        output.className = 'error';
        return;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        output.textContent = 'Enter an amount greater than zero.';
        output.className = 'error';
        return;
      }

      let wallet;
      try {
        wallet = JSON.parse(localStorage.getItem('blockchainWallet') || 'null');
      } catch {
        wallet = null;
      }

      if (!wallet || !wallet.privateKey || !wallet.publicKey) {
        output.textContent = 'Create a browser wallet first.';
        output.className = 'error';
        return;
      }

      if (recipient === wallet.publicKey) {
        output.textContent = 'Choose a different recipient address.';
        output.className = 'error';
        return;
      }

      button.disabled = true;
      output.textContent = 'Checking balance and signing transaction...';

      try {
        const balanceResponse = await fetch(
          '/api/balance?address=' + encodeURIComponent(wallet.publicKey),
          { cache: 'no-store' }
        );
        const balanceData = await balanceResponse.json();
        if (!balanceResponse.ok) {
          throw new Error(balanceData.error || 'Could not check wallet balance.');
        }

        if (amount > balanceData.balance) {
          throw new Error(
            'Insufficient balance. Your wallet has ' + balanceData.balance + ' coins.'
          );
        }

        const transaction = await window.BrowserWallet.signTransaction(
          wallet, recipient, amount
        );

        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transaction)
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Transaction rejected.');
        }

        output.textContent =
          (result.message || 'Transaction accepted.') +
          '. It is pending mining; balances change after it is mined.';
        output.className = 'valid';
        byId('sendAmount').value = '';
        await loadChain();
      } catch (error) {
        output.textContent = error.message || 'Could not send transaction.';
        output.className = 'error';
      } finally {
        button.disabled = false;
      }
    }

    byId('importWalletButton').addEventListener('click', importWallet);
    byId('sendButton').addEventListener('click', sendCoins);

    byId('refreshButton').addEventListener('click', loadChain);
    byId('mineButton').addEventListener('click', mineBlock);
    byId('createWalletButton').addEventListener('click', createWallet);

    async function mineBlock() {
      const button = byId('mineButton');
      const output = byId('mineResult');
      let wallet;

      try {
        wallet = JSON.parse(localStorage.getItem('blockchainWallet') || 'null');
      } catch {
        wallet = null;
      }

      if (!wallet || !wallet.publicKey) {
        output.textContent = 'Create or import a browser wallet first.';
        output.className = 'error';
        return;
      }

      button.disabled = true;
      output.textContent = 'Mining block...';
      output.className = 'muted';

      try {
        const response = await fetch('/api/mine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ minerAddress: wallet.publicKey })
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Mining failed.');
        }

        output.textContent =
          'Block mined successfully! Reward: ' +
          result.reward.amount + ' coins.';
        output.className = 'valid';
        await loadChain();
        await checkBalanceForWallet(wallet.publicKey);
      } catch (error) {
        output.textContent = error.message || 'Mining failed.';
        output.className = 'error';
      } finally {
        button.disabled = false;
      }
    }

    async function checkBalanceForWallet(address) {
      const response = await fetch(
        '/api/balance?address=' + encodeURIComponent(address),
        { cache: 'no-store' }
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Balance lookup failed.');
      byId('mineResult').textContent += ' Wallet balance: ' + result.balance + ' coins.';
    }
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
