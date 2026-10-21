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
    for (let i = 0; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];

      if (currentBlock.hash !== currentBlock.calculateBlockHash()) {
        return false;
      }

      if (i > 0) {
        const previousBlock = this.chain[i - 1];

        if (currentBlock.previousHash !== previousBlock.hash) {
          return false;
        }
      }
    }

    return true;
  }
}

module.exports = Blockchain;
