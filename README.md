Blockchain Learning Project

A simple educational blockchain built with Node.js and JavaScript to explore block hashing, digital signatures, wallet balances, transactions, and mining rewards.

Features

- SHA-256 hashing — generates a hash for each block.
- Linked blocks — each block stores the previous block's hash.
- Digital wallets — creates public/private key pairs using elliptic-curve cryptography.
- Signed transactions — verifies transaction signatures before accepting transactions.
- Balance tracking — calculates balances from transactions and mining rewards.
- Mining rewards — awards 50 coins to a miner in the current implementation.
- Tampering detection — checks block hashes and links to detect unauthorized changes.
- REST API — provides endpoints for viewing blocks, checking balances, creating demo wallets, submitting transactions, and mining.
- Automated tests — tests blockchain validity, signatures, balances, transactions, and mining rewards.

Technologies

- Node.js
- JavaScript (CommonJS)
- Node.js built-in HTTP server
- Node.js "crypto" module
- SHA-256
- Elliptic-curve digital signatures
- Node.js test runner

Project Structure

blockchain/
├── src/
│   ├── block.js
│   ├── blockchain.js
│   ├── transaction.js
│   ├── wallet.js
│   └── utils.js
├── tests/
│   └── blockchain.test.js
├── demos/
│   ├── link-test.js
│   ├── signature-test.js
│   └── tampering-test.js
├── server.js
├── package.json
├── .gitignore
└── README.md

Requirements

- Node.js (a recent supported version)
- npm
- Termux on Android, or a computer with a terminal

Installation

Clone the repository:

git clone https://github.com/geyachewedajo-ops/blockchain.git
cd blockchain

Install dependencies if required:

npm install

Run the Tests

npm test

The project passed 24 automated tests during development, covering blockchain validity, transaction validation, digital signatures, balance calculations, mining rewards, and tampering detection.

Start the API Server

npm start

The server is configured to listen on:

http://127.0.0.1:3000

Keep the server running in your terminal while testing the API.

API Endpoints

Method| Endpoint| Purpose
GET| "/api/chain"| Retrieve the blockchain and its validity status
GET| "/api/blocks"| Retrieve blocks
GET| "/api/validate"| Check blockchain validity
GET| "/api/blocks/:index"| Retrieve a block by index
GET| "/api/balance/:address"| Check a wallet balance
GET| "/api/balance?address=..."| Check a balance using a public-key address
POST| "/api/wallets"| Create a demo wallet
POST| "/api/transactions"| Submit a signed transaction
POST| "/api/mine"| Mine a demo block and award a reward

Example: Check Blockchain Validity

With the server running, open another terminal and run:

curl http://127.0.0.1:3000/api/validate

Example: View the Blockchain

curl http://127.0.0.1:3000/api/chain

Example: Check a Wallet Balance

Replace "YOUR_PUBLIC_KEY" with the appropriate public key:

curl --get \
  --data-urlencode "address=YOUR_PUBLIC_KEY" \
  http://127.0.0.1:3000/api/balance

Security Tests

The demonstration scripts show how the blockchain responds to attempted tampering.

Run the individual demonstrations:

node demos/link-test.js
node demos/signature-test.js
node demos/tampering-test.js

These tests demonstrate:

1. Detection of a broken previous-block hash link.
2. Rejection of a modified signed transaction.
3. Detection of changes to recorded block data.

Current Limitations

This is a learning project, not a production cryptocurrency.

- Blockchain data is stored in memory and is reset when the server restarts.
- There is no distributed peer-to-peer network or consensus protocol.
- Mining is a demonstration mechanism, not proof-of-work mining.
- Wallet management and API security need further hardening.
- The blockchain has not been independently security-audited.

Do not expose the server publicly or use real funds with this implementation. Never publish private keys, wallet files, passwords, or other secrets.

Future Improvements

- Add persistent blockchain storage.
- Strengthen block, transaction, and mining-reward validation.
- Improve API security and error handling.
- Build a React dashboard for blocks, transactions, and wallet balances.
- Explore Solidity smart contracts and Web3 integration.

Author

Wedajo Getachew

Full-Stack Developer | Node.js | JavaScript | Blockchain Learning

GitHub: https://github.com/geyachewedajo-ops

License

See the repository's "package.json" and any accompanying license file for the project's licensing information.
