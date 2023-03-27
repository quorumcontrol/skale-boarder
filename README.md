# SKALE Boarder

Super simple identity and user-onboarding for the SKALE network (but would work well on any cheap/free gas chain).

Warning: this repo is in active development and should not yet be used for critical applications.

## TLDR;

Implement a non-custodial sign-in system that allows in-browser transaction relay without requiring users to switch their wallets.

## Why?

Many dapps want to keep their operations on SKALE, but still allow easy onboarding from users on other EVM chains.

Network switching is still prohibited on some wallets (like Rainbow), and still difficult on many wallets (especially Metamask on mobile).

There are also many usecases where a dapp does not want or need a user to sign every single transaction due to more limited security use cases (such as in-game transactions).

## High level process

* connect a wallet, sign a message authorizing this "device" to relay transactions
* create an in-browser EOA wallet
* deploy a gnosis safe owned by original signer and the inbrowser wallet
* fund the inbrowser wallet (this repo provides a hook for a custom faucet)

Now the site can relay transactions through the gnosis safe using the in-browser wallet.

## Repo Layout

In the `packages` directory you'll find example code (contracts and a UI) along with the libraries.

There are hooks for:
* WAGMI
* rainbowkit

These make using the safe-tools library in those environments seamless and can wrap other wallets.
