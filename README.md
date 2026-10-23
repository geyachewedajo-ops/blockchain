# JavaScript Blockchain Platform

A blockchain implementation built with Node.js and JavaScript, featuring cryptographic hashing, digital signatures, wallet management, transaction validation, proof-of-work mining, and persistent blockchain storage.

**Developer:** Wedajo Getachew
**GitHub:** https://github.com/geyachewedajo-ops
**Repository:** https://github.com/geyachewedajo-ops/blockchain

## Features

- Blockchain creation and block validation
- SHA-256 cryptographic hashing
- Linked blocks using previous-block hashes
- Wallet creation and public-key addresses
- Digitally signed transaction validation
- Wallet balance calculation
- Proof-of-work mining
- Mining rewards
- Persistent blockchain storage
- Browser-based blockchain explorer
- REST API for blockchain operations
- Automated tests using Node.js

## Technologies

- JavaScript
- Node.js
- Node.js HTTP server
- Node.js Crypto module
- @noble/curves
- SHA-256
- Node.js test runner

## Requirements

- Node.js
- npm
- Git
- Termux or another terminal

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/geyachewedajo-ops/blockchain.git
cd blockchain
npm install
```

If you already cloned the project, open its directory and run `npm install`.

## Run Tests

```bash
npm test
```

The project previously passed 51 tests with zero failures. Run the tests again to verify the current version.

## Start the Blockchain Explorer

```bash
npm start
```

Open this address in a browser on the same device:

http://127.0.0.1:3000

Keep the Node.js server running while using the explorer.

## Blockchain Persistence

The application saves blockchain data locally in `blockchain-data.json` and attempts to restore the saved chain when the server starts.

Keep backups of important local data. Do not commit wallet files, private keys, or other secrets to GitHub.

## REST API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/chain` | Retrieve the blockchain |
| GET | `/api/blocks` | Retrieve blocks |
| GET | `/api/blocks/:index` | Retrieve a block by index |
| GET | `/api/validate` | Validate the blockchain |
| GET | `/api/wallet/public-address` | Retrieve the configured public address |
| GET | `/api/balance?address=...` | Check a wallet balance |
| GET | `/api/balance/:address` | Check a balance by address |
| POST | `/api/wallets` | Create a demo wallet |
| POST | `/api/transactions` | Submit a signed transaction |
| POST | `/api/mine` | Mine a block and process its reward |

### Check Blockchain Validity

```bash
curl -sS http://127.0.0.1:3000/api/validate
```

### View the Blockchain

```bash
curl -sS http://127.0.0.1:3000/api/chain
```

### Check a Wallet Balance

```bash
curl -sS -G --data-urlencode "address=YOUR_PUBLIC_KEY" \
  http://127.0.0.1:3000/api/balance
```

Replace `YOUR_PUBLIC_KEY` with a public wallet address. Never share a private key.

## Demonstration Scripts

```bash
node demos/link-test.js
node demos/signature-test.js
node demos/tampering-test.js
```

These scripts demonstrate blockchain integrity, signature verification, and tampering detection.

## Security and Limitations

This project is a blockchain implementation for development and demonstration purposes. It is not a production-ready cryptocurrency.

- It does not implement a complete distributed peer-to-peer network.
- API security and wallet management require further review.
- The project has not been independently security-audited.
- Mining rewards are demonstration coins, not real-world currency.
- Local persistence does not replace secure backups.
- Never publish private keys, passwords, or wallet files.
- Do not use real funds with this implementation.

The server listens on localhost by default. Review security carefully before exposing it to other devices or the internet.

## Future Improvements

- Expand automated test coverage
- Improve transaction history and block details
- Strengthen API authentication and authorization
- Improve error handling and documentation
- Develop a modern web dashboard

## License

The project declares the ISC license in `package.json`. Check the repository for a license file.
