# SKALE Relayer
## Trusted Forwarder TX Relay System

SKALE Relayer is a smart contract and SDK that allows users to sign a token and then allow a different wallet to send schain transactions on their behalf. This allows users to securely authorize a device or application to perform transactions on their behalf, without having to share their private key.

This means that we can create a temporary wallet in a user's browser, authorize it on behalf of the main account and then the users browser can send transactions without requiring a signature per transaction.

The contract uses OpenZeppelin's contracts for Meta transactions and signature verification.

### Features

* Plain english popup for initial signature lets users feel comfortable signing
* Users do not need to switch networks to use an schain
* Users do not need to sign every transaction (great for games!)
* Verify and execute Ethereum transactions on behalf of the user
* Revoke tokens for added security
* Multi-execute multiple transactions in a single call
* Verify transaction details including from address, relayer address, issued at, session expiry, and signature


### Getting Started
//TODO