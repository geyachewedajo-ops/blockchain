const crypto = require("crypto");

class Block {
  constructor(index, data, previousHash = "") {
    this.index = index;
    this.timestamp = new Date().toISOString();
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    const content =
      this.index +
      this.timestamp +
      JSON.stringify(this.data) +
      this.previousHash;

    return crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");
  }
}

class Blockchain {
  constructor() {
    this.chain = [
      new Block(0, "Genesis Block", "0")
    ];
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(data) {
    const previous = this.getLatestBlock();

    const block = new Block(
      this.chain.length,
      data,
      previous.hash
    );

    this.chain.push(block);
  }

  isValid() {
    for (let i = 0; i < this.chain.length; i++) {
      const current = this.chain[i];

      if (current.hash !== current.calculateHash()) {
        return false;
      }

      if (i > 0) {
        const previous = this.chain[i - 1];

        if (current.previousHash !== previous.hash) {
          return false;
        }

        if (current.index !== previous.index + 1) {
          return false;
        }
      }
    }

    return true;
  }
}

const wedajoChain = new Blockchain();

wedajoChain.addBlock({
  from: "Wedajo",
  to: "Abdi",
  amount: 100
});

wedajoChain.addBlock({
  from: "Abdi",
  to: "Hana",
  amount: 30
});

console.log("=== WEDAJOCHAIN ===");
console.log("Blocks:", wedajoChain.chain.length);
console.log("Before tampering:", wedajoChain.isValid());

// Simulate changing a stored transaction
wedajoChain.chain[1].data.amount = 999999;

console.log("After tampering:", wedajoChain.isValid());
console.log(
  "Tampering detected:",
  !wedajoChain.isValid()
);
