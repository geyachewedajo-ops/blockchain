const Block = require('./block');
const Transaction = require('./transaction');

class Blockchain {
  getBalanceOfAddress(address) {
    return this.getBalance(address);
  }

  constructor() {
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

  addBlock(data) {
    if (data instanceof Transaction) {
      if (!data.isValid()) {
        throw new Error('Invalid transaction');
      }

      if (!data.verifySignature()) {
        throw new Error('Invalid or missing transaction signature');
      }

      // A new address cannot spend coins it has not received.
      // The sender address must match the signed transaction.
      if (this.getBalance(data.from) < data.amount) {
        throw new Error('Insufficient balance');
      }
    }

    const previousBlock = this.getLatestBlock();

    const newBlock = new Block(
      previousBlock.index + 1,
      new Date().toISOString(),
      data,
      previousBlock.hash
    );

    this.chain.push(newBlock);
    return newBlock;
  }


  mineBlock(minerAddress, data) {
    if (typeof minerAddress !== 'string' || !minerAddress.trim()) {
      throw new Error('Invalid miner address');
    }

    const block = this.addBlock(data);
    const rewardKey = block.index;

    if (this.rewardedBlocks.has(rewardKey)) {
      throw new Error('Mining reward already claimed for this block');
    }

    block.reward = {
      to: minerAddress,
      amount: this.miningReward,
    };

    // Recalculate after adding the reward so the hash includes it.
    block.hash = block.calculateBlockHash();
    this.rewardedBlocks.add(rewardKey);

    return block;
  }

  getBalance(address) {
    let balance = 0;

    for (const block of this.chain) {
      const tx = block.data;

      if (tx instanceof Transaction) {
        if (tx.to === address) {
          balance += tx.amount;
        }

        if (tx.from === address) {
          balance -= tx.amount;
        }
      }

      // Mining rewards are counted even when block.data is not a Transaction.
      if (block.reward && block.reward.to === address) {
        balance += block.reward.amount;
      }
    }

    return balance;
  }

  isChainValid() {
    const balances = new Map();

    for (let i = 0; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];

      // Block indexes must be sequential, starting at zero.
      if (currentBlock.index !== i) {
        return false;
      }

      // Rebuild balances from the ledger in block order.
      if (currentBlock.data instanceof Transaction) {
        const tx = currentBlock.data;

        if (!tx.isValid() || !tx.verifySignature()) {
          return false;
        }

        const senderBalance = balances.get(tx.from) || 0;

        if (senderBalance < tx.amount) {
          return false;
        }

        balances.set(tx.from, senderBalance - tx.amount);
        balances.set(
          tx.to,
          (balances.get(tx.to) || 0) + tx.amount
        );
      }

      // The genesis block must not create mining rewards.
      if (i === 0 && currentBlock.reward != null) {
        return false;
      }

      // Validate every mining reward, even if its hash was recalculated.
      if (currentBlock.reward != null) {
        const reward = currentBlock.reward;

        if (
          typeof reward !== 'object' ||
          Array.isArray(reward) ||
          typeof reward.to !== 'string' ||
          !reward.to.trim() ||
          reward.amount !== this.miningReward
        ) {
          return false;
        }
      }

      if (currentBlock.hash !== currentBlock.calculateBlockHash()) {
        return false;
      }

      if (i > 0) {
        const previousBlock = this.chain[i - 1];

        if (currentBlock.previousHash !== previousBlock.hash) {
          return false;
        }
      }

      // Credit the validated mining reward after checking the block.
      if (currentBlock.reward) {
        const { to, amount } = currentBlock.reward;
        balances.set(to, (balances.get(to) || 0) + amount);
      }
    }

    return true;
  }
}

module.exports = Blockchain;
