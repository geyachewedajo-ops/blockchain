const { calculateHash } = require('./utils');

class Block {
  constructor(index, timestamp, data, previousHash = '0') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.reward = null;
    this.hash = this.calculateBlockHash();
  }

  calculateBlockHash() {
    return calculateHash({
      index: this.index,
      timestamp: this.timestamp,
      data: this.data,
      previousHash: this.previousHash,
      reward: this.reward,
    });
  }
}

module.exports = Block;
