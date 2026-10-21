import { secp256k1 } from '@noble/curves/secp256k1.js';

const PUBLIC_KEY_PREFIX =
  '3056301006072a8648ce3d020106052b8104000a034200';

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^(?:[0-9a-f]{2})+$/i.test(hex)) {
    throw new Error('Invalid private key');
  }

  return Uint8Array.from(
    hex.match(/.{2}/g),
    byte => parseInt(byte, 16)
  );
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function publicKeyToPem(rawPublicKey) {
  const der = hexToBytes(
    PUBLIC_KEY_PREFIX + bytesToHex(rawPublicKey)
  );
  const base64 = bytesToBase64(der);
  const lines = base64.match(/.{1,64}/g).join('\n');

  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----`;
}

async function sha256(text) {
  return new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text)
    )
  );
}

const BrowserWallet = {
  create() {
    const privateKey = secp256k1.utils.randomSecretKey();
    const rawPublicKey = secp256k1.getPublicKey(privateKey, false);

    return {
      publicKey: publicKeyToPem(rawPublicKey),
      privateKey: bytesToHex(privateKey)
    };
  },

  async signTransaction(wallet, to, amount) {
    const privateKey = hexToBytes(wallet.privateKey);

    const transaction = {
      from: wallet.publicKey,
      to,
      amount
    };

    const signingData = JSON.stringify(transaction);
    const hash = await sha256(signingData);

    const signature = secp256k1.sign(hash, privateKey, {
      prehash: false,
      format: 'der'
    });

    return {
      ...transaction,
      signature: bytesToHex(signature)
    };
  }
};

window.BrowserWallet = BrowserWallet;
