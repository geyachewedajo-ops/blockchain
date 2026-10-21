const Block = require('./block');
const Transaction = require('./transaction');

class Blockchain {
  constructor() {
    this.miningDifficulty = 2;
    this.chain = [this.createGenesisBlock()];
    this.miningReward = 50;
    this.rewardedBlocks = new Set();
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

  getBalanceOfAddress(address) {
    return this.getBalance(address);
  }

  addBlock(data) {
    if (data instanceof Transaction) {
      if (!data.isValid()) {
        throw new Error('Invalid transaction');
      }

      if (!data.verifySignature()) {
        throw new Error('Invalid or missing transaction signature');
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

    if (data instanceof Transaction) {
      if (!data.isValid()) {
        throw new Error('Invalid transaction');
      }

      if (!data.verifySignature()) {
        throw new Error('Invalid or missing transaction signature');
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

    block.reward = {
      to: minerAddress,
      amount: this.miningReward,
    };

    block.mineBlock(this.miningDifficulty);

    this.chain.push(block);
    this.rewardedBlocks.add(block.index);

    return block;
  }

  getBalance(address) {
    let balance = 0;

    for (const block of this.chain) {
      if (block.data instanceof Transaction) {
        const tx = block.data;

        if (tx.to === address) balance += tx.amount;
        if (tx.from === address) balance -= tx.amount;
      }

      if (block.reward && block.reward.to === address) {
        balance += block.reward.amount;
      }
    }

    return balance;
  }

  isChainValid() {
    const balances = new Map();

    for (let i = 0; i < this.chain.length; i++) {
      const block = this.chain[i];

      if (block.index !== i) return false;

      if (i === 0) {
        if (block.reward != null) return false;
        if (block.hash !== block.calculateBlockHash()) return false;
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

      if (block.data instanceof Transaction) {
        const tx = block.data;

        if (!tx.isValid() || !tx.verifySignature()) return false;

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
