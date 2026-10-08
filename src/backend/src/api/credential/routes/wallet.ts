const holderAuth = { strategies: ['users-permissions'], scope: ['api::credential.credential.find'] }
export default { routes: [
  { method: 'POST', path: '/holder/credentials/:id/wallet-offer', handler: 'wallet.offer', config: { auth: holderAuth } },
  { method: 'GET', path: '/holder/credentials/:id/wallet-copies', handler: 'wallet.copies', config: { auth: holderAuth } },
  { method: 'GET', path: '/holder/wallets', handler: 'wallet.wallets', config: { auth: holderAuth } },
  { method: 'DELETE', path: '/holder/wallets/:walletId', handler: 'wallet.removeWallet', config: { auth: holderAuth } },
  { method: 'POST', path: '/holder/wallet-offers/:offerId/decision', handler: 'wallet.decideWallet', config: { auth: holderAuth } },
  { method: 'POST', path: '/exchanges/:exchangeId', handler: 'wallet.exchange', config: { auth: false } },
  { method: 'GET', path: '/exchanges/:exchangeId', handler: 'wallet.exchange', config: { auth: false } },
] }
