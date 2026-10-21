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
