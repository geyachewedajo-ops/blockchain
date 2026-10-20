const Wallet = require('../src/wallet');
const Transaction = require('../src/transaction');

const sender = new Wallet();
const receiver = new Wallet();

// Create and sign a transaction.
const tx = new Transaction(sender.publicKey, receiver.publicKey, 5);
tx.signTransaction(sender);

console.log('1. Original transaction amount:', tx.amount);
console.log('2. Original signature valid:', tx.verifySignature());

// Simulate an attacker changing the amount.
tx.amount = 500;

console.log('\n3. Changed transaction amount:', tx.amount);
console.log('4. Signature valid after attack:', tx.verifySignature());

if (!tx.verifySignature()) {
  console.log('\nSUCCESS: Unauthorized transaction change detected!');
} else {
  console.log('\nFAIL: Signature verification did not detect the change.');
}
