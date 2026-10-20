const Blockchain = require('../src/blockchain');

const testChain = new Blockchain();

// Record a sample transaction.
testChain.addBlock({
  from: 'Alice',
  to: 'Bob',
  amount: 5
});

console.log('1. Before tampering:');
console.log('   Amount:', testChain.chain[1].data.amount);
console.log('   Chain valid:', testChain.isChainValid());

// Simulate an attacker changing the recorded amount.
testChain.chain[1].data.amount = 500;

console.log('\n2. After tampering:');
console.log('   Amount:', testChain.chain[1].data.amount);
console.log('   Chain valid:', testChain.isChainValid());

if (!testChain.isChainValid()) {
  console.log('\nSUCCESS: Tampering detected!');
} else {
  console.log('\nFAIL: Tampering was not detected.');
}
