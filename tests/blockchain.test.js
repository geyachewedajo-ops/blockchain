const Wallet = require('../src/wallet');
const test = require('node:test');
const assert = require('node:assert/strict');

const Block = require('../src/block');
const Blockchain = require('../src/blockchain');

const Transaction = require('../src/transaction');
test('creates a valid blockchain', () => {
  const bc = new Blockchain();

  bc.addBlock({ amount: 100, from: 'Alice', to: 'Bob' });
  bc.addBlock({ amount: 50, from: 'Bob', to: 'Carol' });

  assert.equal(bc.chain.length, 3);
  assert.equal(bc.isChainValid(), true);
});

test('detects transaction tampering', () => {
  const bc = new Blockchain();

  bc.addBlock({ amount: 100, from: 'Alice', to: 'Bob' });
  bc.chain[1].data.amount = 999;

  assert.equal(bc.isChainValid(), false);
});

test('detects a broken block link', () => {
  const bc = new Blockchain();

  bc.addBlock({ amount: 100, from: 'Alice', to: 'Bob' });
  bc.addBlock({ amount: 50, from: 'Bob', to: 'Carol' });

  bc.chain[2].previousHash = 'invalid-hash';

  assert.equal(bc.isChainValid(), false);
});

test('creates a block with a SHA-256 hash', () => {
  const block = new Block(
    0,
    '2026-01-01T00:00:00.000Z',
    'Test block'
  );

  assert.match(block.hash, /^[a-f0-9]{64}$/);
});


test('accepts a valid transaction', () => {
  const tx = new Transaction('Alice', 'Bob', 100);
  assert.equal(tx.isValid(), true);
});

test('rejects a negative transaction amount', () => {
  const tx = new Transaction('Alice', 'Bob', -10);
  assert.equal(tx.isValid(), false);
});

test('rejects a transaction with an empty sender', () => {
  const tx = new Transaction('', 'Bob', 100);
  assert.equal(tx.isValid(), false);
});

test('rejects a transaction to the same sender', () => {
  const tx = new Transaction('Alice', 'Alice', 100);
  assert.equal(tx.isValid(), false);
});


test('rejects a signed transaction from an unfunded wallet', () => {
  const bc = new Blockchain();
  const wallet = new Wallet();
  const recipient = new Wallet();

  const tx = new Transaction(
    wallet.publicKey,
    recipient.publicKey,
    100
  );
  tx.signTransaction(wallet);

  assert.throws(() => bc.addBlock(tx), /insufficient balance/i);

  assert.equal(bc.chain.length, 1);
  assert.equal(bc.getBalance(wallet.publicKey), 0);
  assert.equal(bc.getBalance(recipient.publicKey), 0);
  assert.equal(bc.isChainValid(), true);
});

test('rejects an invalid Transaction when adding a block', () => {
  const bc = new Blockchain();
  const tx = new Transaction('Alice', 'Bob', -10);

  assert.throws(() => bc.addBlock(tx), /Invalid transaction/);
  assert.equal(bc.chain.length, 1);
});


test('verifies a valid digital signature', () => {
  const wallet = new Wallet();
  const data = 'WEDAJOCHAIN transaction';
  const signature = wallet.sign(data);

  assert.equal(
    Wallet.verify(wallet.publicKey, data, signature),
    true
  );
});

test('rejects a signature when signed data is changed', () => {
  const wallet = new Wallet();
  const signature = wallet.sign('Alice pays Bob 100');

  assert.equal(
    Wallet.verify(wallet.publicKey, 'Alice pays Bob 999', signature),
    false
  );
});

test('signs and verifies a transaction', () => {
  const wallet = new Wallet();
  const tx = new Transaction('Alice', 'Bob', 100);

  tx.signTransaction(wallet);

  assert.equal(tx.from, wallet.publicKey);
  assert.equal(tx.verifySignature(), true);
});

test('detects a modified signed transaction', () => {
  const wallet = new Wallet();
  const tx = new Transaction('Alice', 'Bob', 100);

  tx.signTransaction(wallet);
  tx.amount = 999;

  assert.equal(tx.verifySignature(), false);
});

test('rejects an unsigned transaction', () => {
  const bc = new Blockchain();
  const tx = new Transaction('Alice', 'Bob', 100);

  assert.throws(
    () => bc.addBlock(tx),
    /signature/i
  );

  assert.equal(bc.chain.length, 1);
});

test('rejects an unfunded transaction inserted directly into the chain', () => {
  const bc = new Blockchain();
  const sender = new Wallet();
  const recipient = new Wallet();

  const tx = new Transaction(
    sender.publicKey,
    recipient.publicKey,
    10
  );
  tx.signTransaction(sender);

  const forgedBlock = new Block(
    1,
    new Date().toISOString(),
    tx,
    bc.getLatestBlock().hash
  );

  bc.chain.push(forgedBlock);

  assert.equal(bc.isChainValid(), false);
});

test('rejects a tampered transaction even when its block hash is recalculated', () => {
  const bc = new Blockchain();
  const wallet = new Wallet();
  const recipient = new Wallet();
  const attacker = new Wallet();

  bc.mineBlock(wallet.publicKey, 'Initial mining reward');

  const tx = new Transaction(
    wallet.publicKey,
    recipient.publicKey,
    10
  );
  tx.signTransaction(wallet);
  bc.addBlock(tx);

  const transactionBlock = bc.getLatestBlock();
  transactionBlock.data.from = attacker.publicKey;
  transactionBlock.hash = transactionBlock.calculateBlockHash();

  assert.equal(bc.isChainValid(), false);
});

test('detects a modified transaction sender', () => {
  const wallet = new Wallet();
  const recipient = new Wallet();
  const tx = new Transaction(
    wallet.publicKey,
    recipient.publicKey,
    10
  );

  tx.signTransaction(wallet);
  tx.from = recipient.publicKey;

  assert.equal(tx.verifySignature(), false);
});

test('rejects spending when the sender has no balance', () => {
  const bc = new Blockchain();
  const aliceWallet = new Wallet();
  const bobWallet = new Wallet();

  const tx = new Transaction(
    aliceWallet.publicKey,
    bobWallet.publicKey,
    25
  );

  tx.signTransaction(aliceWallet);

  assert.throws(
    () => bc.addBlock(tx),
    /insufficient balance/i
  );

  assert.equal(bc.chain.length, 1);
  assert.equal(bc.getBalance(aliceWallet.publicKey), 0);
  assert.equal(bc.getBalance(bobWallet.publicKey), 0);
});




test('calculates a positive balance from a received transaction', () => {
  const Blockchain = require('../src/blockchain');
  const Transaction = require('../src/transaction');

  const bc = new Blockchain();
  const transaction = new Transaction('sender-address', 'alice-address', 100);

  // This test checks balance calculation, not transaction authorization.
  bc.chain.push({
    data: transaction
  });

  assert.equal(bc.getBalanceOfAddress('alice-address'), 100);
  assert.equal(bc.getBalance('alice-address'), 100);
});

test('awards 50 coins to a miner', () => {
  const bc = new Blockchain();
  const miner = new Wallet();

  const block = bc.mineBlock(miner.publicKey, {
    message: 'Mining demonstration',
  });

  assert.equal(block.reward.to, miner.publicKey);
  assert.equal(block.reward.amount, 50);
  assert.equal(bc.getBalance(miner.publicKey), 50);
});

test('detects mining reward tampering', () => {
  const bc = new Blockchain();
  const miner = new Wallet();

  bc.mineBlock(miner.publicKey, {
    message: 'Mining demonstration',
  });

  assert.equal(bc.isChainValid(), true);

  bc.chain[1].reward.amount = 5000;

  assert.equal(bc.isChainValid(), false);
});

test('allows a miner to send coins after receiving a reward', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  const receiver = new Wallet();

  bc.mineBlock(miner.publicKey, {
    message: 'Mining demonstration',
  });

  const tx = new Transaction(
    miner.publicKey,
    receiver.publicKey,
    20
  );

  tx.signTransaction(miner);
  bc.addBlock(tx);

  assert.equal(bc.getBalance(miner.publicKey), 30);
  assert.equal(bc.getBalance(receiver.publicKey), 20);
  assert.equal(bc.isChainValid(), true);
});

test('rejects a forged mining reward even when the block hash is recalculated', () => {
  const blockchain = new Blockchain();

  const block = blockchain.mineBlock('miner-address', 'Mining test');
  block.reward.amount = 500;
  block.hash = block.calculateBlockHash();

  assert.equal(blockchain.isChainValid(), false);
});

test('rejects duplicate mining rewards for the same block', () => {
  const blockchain = new Blockchain();
  const miner = new Wallet();

  const block = blockchain.mineBlock(
    miner.publicKey,
    'Mining test'
  );

  // Attempt to claim the same block reward twice.
  block.reward = [
    { to: miner.publicKey, amount: blockchain.miningReward },
    { to: miner.publicKey, amount: blockchain.miningReward },
  ];

  block.hash = block.calculateBlockHash();

  assert.equal(blockchain.isChainValid(), false);
});

test('rejects duplicate block indexes with duplicate mining rewards', () => {
  const blockchain = new Blockchain();
  const miner = new Wallet();

  const originalBlock = blockchain.mineBlock(
    miner.publicKey,
    'Original mining reward'
  );

  const duplicateBlock = new Block(
    originalBlock.index,
    new Date().toISOString(),
    'Duplicate mining reward',
    originalBlock.hash
  );

  duplicateBlock.reward = {
    to: miner.publicKey,
    amount: blockchain.miningReward,
  };
  duplicateBlock.hash = duplicateBlock.calculateBlockHash();
  blockchain.chain.push(duplicateBlock);

  assert.equal(blockchain.isChainValid(), false);
});

test('rejects a repeated mining reward in a later block', () => {
  const blockchain = new Blockchain();
  const miner = new Wallet();

  const firstBlock = blockchain.mineBlock(
    miner.publicKey,
    'First mining reward'
  );

  const secondBlock = blockchain.addBlock(
    'Second block without mining'
  );

  // Forge another reward for the same miner in a different block.
  secondBlock.reward = {
    to: firstBlock.reward.to,
    amount: blockchain.miningReward,
  };
  secondBlock.hash = secondBlock.calculateBlockHash();

  assert.equal(blockchain.isChainValid(), false);
});


test('queues a valid signed transaction', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund miner');

  const recipient = new Wallet();
  const tx = new Transaction(miner.publicKey, recipient.publicKey, 10);
  tx.signTransaction(miner);

  const queued = bc.addTransaction(tx);

  assert.equal(bc.pendingTransactions.length, 1);
  assert.equal(queued.amount, 10);
  assert.equal(queued.verifySignature(), true);
});

test('rejects an unsigned pending transaction', () => {
  const bc = new Blockchain();
  const wallet = new Wallet();
  const recipient = new Wallet();
  const tx = new Transaction(wallet.publicKey, recipient.publicKey, 1);

  assert.throws(() => bc.addTransaction(tx), /signature/i);
  assert.equal(bc.pendingTransactions.length, 0);
});

test('rejects duplicate pending transactions', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund miner');

  const recipient = new Wallet();
  const tx = new Transaction(miner.publicKey, recipient.publicKey, 10);
  tx.signTransaction(miner);

  bc.addTransaction(tx);
  assert.throws(() => bc.addTransaction(tx), /already pending/i);
  assert.equal(bc.pendingTransactions.length, 1);
});

test('addBlock rejects an already-mined transaction', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund sender');

  const recipient = new Wallet();
  const tx = new Transaction(miner.publicKey, recipient.publicKey, 10);
  tx.signTransaction(miner);
  bc.mineBlock(miner.publicKey, tx);

  assert.throws(() => bc.addBlock(tx), /already mined/i);
  assert.equal(bc.isChainValid(), true);
});

test('mineBlock rejects an already-mined transaction', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund sender');

  const recipient = new Wallet();
  const tx = new Transaction(miner.publicKey, recipient.publicKey, 10);
  tx.signTransaction(miner);
  bc.mineBlock(miner.publicKey, tx);

  assert.throws(
    () => bc.mineBlock(miner.publicKey, tx),
    /already mined/i
  );
  assert.equal(bc.isChainValid(), true);
});

test('rejects a transaction that has already been mined', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund sender');

  const recipient = new Wallet();
  const tx = new Transaction(miner.publicKey, recipient.publicKey, 10);
  tx.signTransaction(miner);

  bc.mineBlock(miner.publicKey, tx);

  assert.throws(
    () => bc.addTransaction(tx),
    /already mined/i
  );
});

test('rejects a replayed transaction inserted directly into a later block', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund sender');

  const recipient = new Wallet();
  const tx = new Transaction(miner.publicKey, recipient.publicKey, 10);
  tx.signTransaction(miner);

  bc.mineBlock(miner.publicKey, tx);

  const previousBlock = bc.getLatestBlock();
  const replay = new Transaction(tx.from, tx.to, tx.amount);
  replay.signature = tx.signature;

  const duplicateBlock = new Block(
    previousBlock.index + 1,
    new Date().toISOString(),
    replay,
    previousBlock.hash
  );

  duplicateBlock.reward = {
    to: miner.publicKey,
    amount: bc.miningReward,
  };
  duplicateBlock.mineBlock(bc.miningDifficulty);
  bc.chain.push(duplicateBlock);

  assert.equal(bc.isChainValid(), false);
});

test('prevents pending transactions from overspending the balance', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  bc.mineBlock(miner.publicKey, 'Fund miner');

  const recipient = new Wallet();
  const first = new Transaction(miner.publicKey, recipient.publicKey, 30);
  first.signTransaction(miner);
  bc.addTransaction(first);

  const secondRecipient = new Wallet();
  const second = new Transaction(miner.publicKey, secondRecipient.publicKey, 30);
  second.signTransaction(miner);

  assert.throws(() => bc.addTransaction(second), /insufficient balance/i);
  assert.equal(bc.pendingTransactions.length, 1);
});


test('mines pending transactions and clears the queue', () => {
  const bc = new Blockchain();
  const miner = new Wallet();
  const sender = new Wallet();
  const recipient = new Wallet();

  bc.mineBlock(sender.publicKey, 'Fund sender');

  const tx = new Transaction(
    sender.publicKey,
    recipient.publicKey,
    10
  );
  tx.signTransaction(sender);
  bc.addTransaction(tx);

  const block = bc.minePendingTransactions(miner.publicKey);

  assert.equal(block.data.length, 1);
  assert.equal(bc.pendingTransactions.length, 0);
  assert.equal(bc.isChainValid(), true);
});

test('awards mining reward when mining pending transactions', () => {
  const bc = new Blockchain();
  const sender = new Wallet();
  const miner = new Wallet();
  const recipient = new Wallet();

  bc.mineBlock(sender.publicKey, 'Fund sender');

  const tx = new Transaction(
    sender.publicKey,
    recipient.publicKey,
    5
  );
  tx.signTransaction(sender);
  bc.addTransaction(tx);

  bc.minePendingTransactions(miner.publicKey);

  assert.equal(bc.getBalance(miner.publicKey), 50);
});

test('updates recipient balance after mining pending transactions', () => {
  const bc = new Blockchain();
  const sender = new Wallet();
  const miner = new Wallet();
  const recipient = new Wallet();

  bc.mineBlock(sender.publicKey, 'Fund sender');

  const tx = new Transaction(
    sender.publicKey,
    recipient.publicKey,
    10
  );
  tx.signTransaction(sender);
  bc.addTransaction(tx);

  bc.minePendingTransactions(miner.publicKey);

  assert.equal(bc.getBalance(recipient.publicKey), 10);
});

test('rejects mining when there are no pending transactions', () => {
  const bc = new Blockchain();
  const miner = new Wallet();

  assert.throws(
    () => bc.minePendingTransactions(miner.publicKey),
    /no pending transactions/i
  );
});


test('rejects an empty blockchain', () => {
  const bc = new Blockchain();
  bc.chain = [];

  assert.equal(bc.isChainValid(), false);
});

test('rejects an empty transaction batch', () => {
  const bc = new Blockchain();
  bc.addBlock([]);

  assert.equal(bc.isChainValid(), false);
});

test('rejects a transaction batch containing an invalid item', () => {
  const bc = new Blockchain();
  bc.addBlock(['not a transaction']);

  assert.equal(bc.isChainValid(), false);
});


test('rejects a mined block whose nonce is changed without valid proof of work', () => {
  const bc = new Blockchain();
  const miner = new Wallet();

  bc.mineBlock(miner.publicKey, 'Proof of work test');

  const block = bc.chain[1];
  do {
    block.nonce += 1;
    block.hash = block.calculateBlockHash();
  } while (block.hasValidProof(bc.miningDifficulty));

  assert.equal(block.hasValidProof(bc.miningDifficulty), false);
  assert.equal(bc.isChainValid(), false);
});

test('rejects invalid mining difficulty values', () => {
  const block = new Block(1, new Date().toISOString(), 'Mining test', '0');

  for (const difficulty of [0, -1, 1.5, 7, NaN]) {
    assert.equal(block.hasValidProof(difficulty), false);
    assert.throws(() => block.mineBlock(difficulty), /difficulty/i);
  }
});

test('rejects a modified genesis previous hash even if its hash is recalculated', () => {
  const bc = new Blockchain();

  bc.chain[0].previousHash = 'tampered';
  bc.chain[0].hash = bc.chain[0].calculateBlockHash();

  assert.equal(bc.isChainValid(), false);
});

test('rejects a non-reward block with a modified nonce and recalculated hash', () => {
  const bc = new Blockchain();

  const block = bc.addBlock('Ordinary block');
  block.nonce = 1;
  block.hash = block.calculateBlockHash();

  assert.equal(bc.isChainValid(), false);
});
