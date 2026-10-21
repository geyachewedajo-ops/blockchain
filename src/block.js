const { calculateHash } = require('./utils');

class Block {
  constructor(index, timestamp, data, previousHash = '0') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.reward = null;
    this.nonce = 0;
    this.hash = this.calculateBlockHash();
  }

  calculateBlockHash() {
    return calculateHash({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
      reward: this.reward,
      nonce: this.nonce,
    });
  }

  mineBlock(difficulty = 2) {
    if (
      !Number.isInteger(difficulty) ||
      difficulty < 1 ||
      difficulty > 6
    ) {
      throw new Error('Invalid mining difficulty');
    }

    const target = '0'.repeat(difficulty);

    while (!this.hash.startsWith(target)) {
      this.nonce++;
      this.hash = this.calculateBlockHash();
    }

    return this.hash;
  }

  hasValidProof(difficulty = 2) {
    if (
      !Number.isInteger(difficulty) ||
      difficulty < 1 ||
      difficulty > 6
    ) {
      return false;
    }

    return (
      this.hash === this.calculateBlockHash() &&
      this.hash.startsWith('0'.repeat(difficulty))
    );
  }
}

module.exports = Block;
