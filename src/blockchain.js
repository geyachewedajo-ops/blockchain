const Block = require('./block');
const Transaction = require('./transaction');

class Blockchain {
  constructor() {
    this.miningDifficulty = 2;
    this.chain = [this.createGenesisBlock()];
    this.miningReward = 50;
    this.rewardedBlocks = new Set();
    this.pendingTransactions = [];
  }

  createGenesisBlock() {
    return new Block(
      0,
      '2026-01-01T00:00:00.000Z',
      'Genesis Block',
      '0'
    );
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  hasTransactionBeenMined(transaction) {
    const signingData = transaction.getSigningData();

    return this.chain.some((block) => {
      const transactions = Array.isArray(block.data)
        ? block.data
        : [block.data];

      return transactions.some(
        (tx) =>
          tx instanceof Transaction &&
          tx.getSigningData() === signingData &&
          tx.signature === transaction.signature
      );
    });
  }

  getBalanceOfAddress(address) {
    return this.getBalance(address);
  }

  addTransaction(transaction) {
    if (!(transaction instanceof Transaction)) {
      throw new Error('Invalid transaction type');
    }

    if (!transaction.isValid()) {
      throw new Error('Invalid transaction');
    }

    if (!transaction.verifySignature()) {
      throw new Error('Invalid or missing transaction signature');
    }

    const signingData = transaction.getSigningData();

    const alreadyMined = this.chain.some((block) => {
      const transactions = Array.isArray(block.data)
        ? block.data
        : [block.data];

      return transactions.some(
        (tx) =>
          tx instanceof Transaction &&
          tx.getSigningData() === signingData &&
          tx.signature === transaction.signature
      );
    });

    if (alreadyMined) {
      throw new Error('Transaction already mined');
    }

    const duplicate = this.pendingTransactions.some(
      (pending) =>
        pending.from === transaction.from &&
        pending.getSigningData() === signingData
    );

    if (duplicate) {
      throw new Error('Transaction already pending');
    }

    const pendingOutgoing = this.pendingTransactions
      .filter((pending) => pending.from === transaction.from)
      .reduce((total, pending) => total + pending.amount, 0);

    const availableBalance =
      this.getBalance(transaction.from) - pendingOutgoing;

    if (availableBalance < transaction.amount) {
      throw new Error('Insufficient balance');
    }

    // Keep a separate copy so changing the original object
    // does not silently modify the queued transaction.
    const queuedTransaction = new Transaction(
      transaction.from,
      transaction.to,
      transaction.amount
    );

    queuedTransaction.signature = transaction.signature;

    this.pendingTransactions.push(queuedTransaction);
    return queuedTransaction;
  }

  validateBlockData(data) {
    if (!Array.isArray(data)) {
      if (!(data instanceof Transaction)) return;

      if (!data.isValid()) {
        throw new Error('Invalid transaction');
      }

      if (!data.verifySignature()) {
        throw new Error('Invalid or missing transaction signature');
      }

      if (this.hasTransactionBeenMined(data)) {
        throw new Error('Transaction already mined');
      }

      if (this.getBalance(data.from) < data.amount) {
        throw new Error('Insufficient balance');
      }

      return;
    }

    if (data.length === 0) {
      throw new Error('Invalid empty transaction batch');
    }

    const seen = new Set();
    const balances = new Map();

    for (const tx of data) {
      if (!(tx instanceof Transaction) ||
          !tx.isValid() ||
          !tx.verifySignature()) {
        throw new Error('Invalid or missing transaction signature');
      }

      const key = JSON.stringify([
        tx.getSigningData(),
        tx.signature,
      ]);

      if (seen.has(key) || this.hasTransactionBeenMined(tx)) {
        throw new Error('Transaction already mined or duplicated in batch');
      }

      seen.add(key);

      const balance = balances.has(tx.from)
        ? balances.get(tx.from)
        : this.getBalance(tx.from);

      if (balance < tx.amount) {
        throw new Error('Insufficient balance');
      }

      balances.set(tx.from, balance - tx.amount);
      balances.set(
        tx.to,
        (balances.has(tx.to) ? balances.get(tx.to) : this.getBalance(tx.to))
          + tx.amount
      );
    }
  }

  addBlock(data) {
    if (data instanceof Transaction) {
      if (!data.isValid()) {
        throw new Error('Invalid transaction');
      }

      if (!data.verifySignature()) {
        throw new Error('Invalid or missing transaction signature');
      }

      if (this.hasTransactionBeenMined(data)) {
        throw new Error('Transaction already mined');
      }

      if (this.getBalance(data.from) < data.amount) {
        throw new Error('Insufficient balance');
      }
    }

    const previousBlock = this.getLatestBlock();

    const block = new Block(
      previousBlock.index + 1,
      new Date().toISOString(),
      data,
      previousBlock.hash
    );

    this.chain.push(block);
    return block;
  }

  mineBlock(minerAddress, data) {
    if (typeof minerAddress !== 'string' || !minerAddress.trim()) {
      throw new Error('Invalid miner address');
    }

    this.validateBlockData(data);

    const previousBlock = this.getLatestBlock();

    const block = new Block(
      previousBlock.index + 1,
      new Date().toISOString(),
      data,
      previousBlock.hash
    );

    block.reward = {
      to: minerAddress,
      amount: this.miningReward,
    };

    block.mineBlock(this.miningDifficulty);

    this.chain.push(block);
    this.rewardedBlocks.add(block.index);

    return block;
  }

  minePendingTransactions(minerAddress) {
    if (typeof minerAddress !== 'string' || !minerAddress.trim()) {
      throw new Error('Invalid miner address');
    }

    if (this.pendingTransactions.length === 0) {
      throw new Error('No pending transactions to mine');
    }

    const balances = new Map();

    for (const block of this.chain) {
      const transactions = Array.isArray(block.data)
        ? block.data
        : [block.data];

      for (const tx of transactions) {
        if (!(tx instanceof Transaction)) continue;

        balances.set(
          tx.from,
          (balances.get(tx.from) || 0) - tx.amount
        );
        balances.set(
          tx.to,
          (balances.get(tx.to) || 0) + tx.amount
        );
      }

      if (block.reward) {
        balances.set(
          block.reward.to,
          (balances.get(block.reward.to) || 0) + block.reward.amount
        );
      }
    }

    for (const tx of this.pendingTransactions) {
      if (
        !(tx instanceof Transaction) ||
        !tx.isValid() ||
        !tx.verifySignature()
      ) {
        throw new Error('Invalid or missing transaction signature');
      }

      const senderBalance = balances.get(tx.from) || 0;

      if (senderBalance < tx.amount) {
        throw new Error('Insufficient balance');
      }

      balances.set(tx.from, senderBalance - tx.amount);
      balances.set(
        tx.to,
        (balances.get(tx.to) || 0) + tx.amount
      );
    }

    const transactions = this.pendingTransactions.map((tx) => {
      const copy = new Transaction(tx.from, tx.to, tx.amount);
      copy.signature = tx.signature;
      return copy;
    });

    const previousBlock = this.getLatestBlock();
    const block = new Block(
      previousBlock.index + 1,
      new Date().toISOString(),
      transactions,
      previousBlock.hash
    );

    block.reward = {
      to: minerAddress,
      amount: this.miningReward,
    };

    block.mineBlock(this.miningDifficulty);

    this.chain.push(block);
    this.rewardedBlocks.add(block.index);
    this.pendingTransactions = [];

    return block;
  }

  getBalance(address) {
    address = typeof address === 'string' ? address.trim() : address;
    let balance = 0;

    for (const block of this.chain) {
      const transactions = Array.isArray(block.data)
        ? block.data
        : [block.data];

      for (const tx of transactions) {
        if (!(tx instanceof Transaction)) continue;

        if (typeof tx.to === 'string' && tx.to.trim() === address) balance += tx.amount;
        if (typeof tx.from === 'string' && tx.from.trim() === address) balance -= tx.amount;
      }

      if (block.reward && typeof block.reward.to === 'string' && block.reward.to.trim() === address) {
        balance += block.reward.amount;
      }
    }

    return balance;
  }

  isChainValid() {
    if (!Array.isArray(this.chain) || this.chain.length === 0) {
      return false;
    }

    const balances = new Map();
    const seenTransactions = new Set();

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];

      if (block.index !== i) return false;

      if (i === 0) {
        if (
          block.timestamp !== '2026-01-01T00:00:00.000Z' ||
          block.data !== 'Genesis Block' ||
          block.previousHash !== '0' ||
          block.nonce !== 0 ||
          block.reward != null ||
          block.hash !== block.calculateBlockHash()
        ) {
          return false;
        }
        continue;
      }

      const previousBlock = this.chain[i - 1];

      if (block.previousHash !== previousBlock.hash) return false;

      if (block.hash !== block.calculateBlockHash()) return false;

      if (block.reward == null) {
        if (block.nonce !== 0) return false;
      } else {
        if (
          typeof block.reward !== 'object' ||
          Array.isArray(block.reward) ||
          typeof block.reward.to !== 'string' ||
          !block.reward.to.trim() ||
          block.reward.amount !== this.miningReward ||
          !block.hasValidProof(this.miningDifficulty)
        ) {
          return false;
        }
      }

      const isTransactionBatch = Array.isArray(block.data);

      if (
        isTransactionBatch &&
        (
          block.data.length === 0 ||
          !block.data.every((tx) => tx instanceof Transaction)
        )
      ) {
        return false;
      }

      const transactions = isTransactionBatch
        ? block.data
        : [block.data];

      for (const tx of transactions) {
        if (!(tx instanceof Transaction)) continue;

        if (!tx.isValid() || !tx.verifySignature()) return false;

        const transactionKey = JSON.stringify([
          tx.getSigningData(),
          tx.signature,
        ]);

        if (seenTransactions.has(transactionKey)) return false;
        seenTransactions.add(transactionKey);

        const senderBalance = balances.get(tx.from) || 0;

        if (senderBalance < tx.amount) return false;

        balances.set(tx.from, senderBalance - tx.amount);
        balances.set(
          tx.to,
          (balances.get(tx.to) || 0) + tx.amount
        );
      }

      if (block.reward) {
        const { to, amount } = block.reward;
        balances.set(to, (balances.get(to) || 0) + amount);
      }
    }

    return true;
  }
}

module.exports = Blockchain;
