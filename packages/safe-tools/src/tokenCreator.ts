import { WalletDeployer } from "../typechain-types"
import { BytesLike, Signer } from 'ethers'

const MIN_VALID_V_VALUE = 27;

export interface PreTokenData {
  stringToSign: BytesLike
  issuedAt: number
  chainId: number
}

export interface Token {
  signature: BytesLike
  issuedAt: number
}

export async function bytesToSignForToken(walletDeployer: WalletDeployer, user: Signer, relayer: Signer):Promise<PreTokenData> {
  const [statement, chainId, blockNumber] = await Promise.all([
    walletDeployer.STATEMENT(),
    relayer.getChainId(),
    relayer.provider!.getBlockNumber()
  ])
  const issuedAt = blockNumber - 1

  let stringToSign = statement +
  "\n\nMy address:" +
  (await user.getAddress()).toLowerCase() +
  "\nDevice:" +
  (await relayer.getAddress()).toLowerCase() +
  "\nIssued at:" +
  issuedAt.toString(10)

  return {
    stringToSign,
    issuedAt,
    chainId,
  }
}

// see https://github.com/gnosis/safe-react/blob/dev/src/logic/safe/transactions/offchainSigner/utils.ts#L26
export const adjustV = (signature: string): string => {
  let sigV = parseInt(signature.slice(-2), 16);

  // Metamask with ledger returns V=0/1 here too, we need to adjust it to be ethereum's valid value (27 or 28)
  if (sigV < MIN_VALID_V_VALUE) {
    sigV += MIN_VALID_V_VALUE;
  }

  return signature.slice(0, -2) + sigV.toString(16);
};

/**
 * createToken does not do any https calls out except for the sign message, this makes it useable for mobile browsers
 * as they will often pop the app store if there are any extraneous requests besides the direct call to wallet connect.
 * see: https://github.com/MetaMask/metamask-mobile/pull/4167
 * @param preTokenData
 * @param user 
 * @returns a sequence of bytes
 */
export async function createToken({ stringToSign, issuedAt }:PreTokenData, user:Signer):Promise<Token> {
  return {
    signature: adjustV(await user.signMessage(stringToSign)),
    issuedAt,
  }
}

export async function getBytesAndCreateToken(walletDeployer: WalletDeployer, user: Signer, relayer: Signer) {
  const preTokenData = await bytesToSignForToken(walletDeployer, user, relayer)
  return createToken(preTokenData, user)
}
