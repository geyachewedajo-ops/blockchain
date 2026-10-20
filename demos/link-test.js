const Blockchain = require('../src/blockchain');

const chain = new Blockchain();

chain.addBlock({ message: 'Block 1' });
chain.addBlock({ message: 'Block 2' });
chain.addBlock({ message: 'Block 3' });

console.log('Before attack:', chain.isChainValid());

// Change block 2's link to block 1.
chain.chain[2].previousHash = 'fake-hash-123';

console.log('After attack:', chain.isChainValid());

if (!chain.isChainValid()) {
  console.log('SUCCESS: Broken block link detected!');
} else {
  console.log('FAIL: Broken link was not detected.');
}
