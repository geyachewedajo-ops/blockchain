const crypto = require('node:crypto');

function calculateHash(data) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

module.exports = {
  calculateHash,
};
