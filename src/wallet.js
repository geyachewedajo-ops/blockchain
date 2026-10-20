const crypto = require('node:crypto');

class Wallet {
  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    this.publicKey = publicKey;
    this.privateKey = privateKey;
  }

  sign(data) {
    const signer = crypto.createSign('SHA256');
    signer.update(data);
    signer.end();

    return signer.sign(this.privateKey, 'hex');
  }

  static verify(publicKey, data, signature) {
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      verifier.end();

      return verifier.verify(publicKey, signature, 'hex');
    } catch {
      return false;
    }
  }
}

module.exports = Wallet;
