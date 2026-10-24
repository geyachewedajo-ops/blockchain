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
