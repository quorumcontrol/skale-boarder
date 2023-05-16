import { TokenAuthenticated } from "../typechain-types";
import { BytesLike, Signer, utils } from "ethers";

const MIN_VALID_V_VALUE = 27;

type Address = string;

export interface TokenRequest {
    owner: string
    device: string
    issuedAt: number
}

interface PreSignData {
  stringToSign: string;
  tokenRequest: TokenRequest;
}

export interface Token {
  signature: BytesLike;
  tokenRequest: TokenRequest;
}

interface TokenAuthenticatedContract {
  createTokenRequest: TokenAuthenticated["createTokenRequest"];
}

export async function bytesToSignForToken(
  contract: TokenAuthenticatedContract,
  owner: Address,
  device: Address,
): Promise<PreSignData> {
  const [tokenRequest, stringToSign] = await contract.createTokenRequest(
    owner,
    device,
  );
  return {
    tokenRequest: {
      ...tokenRequest,
      issuedAt: tokenRequest.issuedAt.toNumber(),
    },
    stringToSign,
  };
}

export async function authenticateTokenRequest(
  statement: string,
  request: TokenRequest,
  signature: BytesLike,
): Promise<boolean> {
  const requestString = utils.solidityPack(
    Array(7).fill("string"),
    [
      statement.trim(),
      "\n\nMe: ",
      request.owner.toLowerCase(),
      "\nDevice: ",
      request.device.toLowerCase(),
      "\nIssued at: ",
      request.issuedAt.toString(),
    ],
  );

  return utils.verifyMessage(utils.toUtf8String(requestString), signature).toLowerCase() === request.owner.toLowerCase();
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
 * @param owner
 * @returns a sequence of bytes
 */
export async function createToken(
  { stringToSign, tokenRequest }: PreSignData,
  owner: Signer,
): Promise<Token> {
  return {
    signature: adjustV(await owner.signMessage(stringToSign)),
    tokenRequest,
  };
}

export async function getBytesAndCreateToken(
  contract: TokenAuthenticatedContract,
  owner: Signer,
  device: Address,
) {
  try {
    const preTokenData = await bytesToSignForToken(
      contract,
      await owner.getAddress(),
      device,
    );
    return createToken(preTokenData, owner);
  } catch (error) {
    console.error("error creating token: ", error);
    throw new Error("Error creating token");
  }
}
