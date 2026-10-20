const Wallet = require('./wallet');

class Transaction {
  constructor(from, to, amount) {
    this.from = from;
    this.to = to;
    this.amount = amount;
    this.signature = null;
  }

  isValid() {
    return (
      typeof this.from === 'string' &&
      this.from.trim().length > 0 &&
      typeof this.to === 'string' &&
      this.to.trim().length > 0 &&
      this.from !== this.to &&
      Number.isFinite(this.amount) &&
      this.amount > 0
    );
  }

  getSigningData() {
    return JSON.stringify({
      from: this.from,
      to: this.to,
      amount: this.amount,
    });
  }

  signTransaction(wallet) {
    if (!this.isValid()) {
      throw new Error('Cannot sign an invalid transaction');
    }

    this.from = wallet.publicKey;
    this.signature = wallet.sign(this.getSigningData());
  }

  verifySignature() {
    if (!this.isValid() || !this.signature) {
      return false;
    }

    return Wallet.verify(
      this.from,
      this.getSigningData(),
      this.signature
    );
  }
}

module.exports = Transaction;
