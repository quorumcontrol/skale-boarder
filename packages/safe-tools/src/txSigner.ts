import { BigNumber, BigNumberish, BytesLike, Signer } from "ethers";
import { keccak256 } from "ethers/lib/utils";
import { GnosisSafeL2 } from "../typechain-types";

const MIN_VALID_V_VALUE = 27;

export enum OPERATION {
  CALL = 0,
  DELEGATE_CALL = 1,
  CREATE = 2,
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

export const knownVAdjust = (signature: string): string => {
  let sigV = parseInt(signature.slice(-2), 16);

  sigV += 4;

  return signature.slice(0, -2) + sigV.toString(16);
};

type Address = string;

export const signer = async function (
  safe: GnosisSafeL2,
  signer: Signer,
  to: Address,
  value: BigNumberish,
  data: BytesLike,
  operation: OPERATION,
  txGasEstimate: BigNumberish,
  baseGasEstimate: BigNumberish,
  gasPrice: BigNumberish,
  txGasToken: Address,
  refundReceiver: Address,
  nonce: BigNumberish,
) {
  if (!BigNumber.isBigNumber(value)) {
    value = BigNumber.from(value);
  }

  data = await safe.encodeTransactionData(
    to,
    value,
    data,
    operation,
    txGasEstimate,
    baseGasEstimate,
    gasPrice,
    txGasToken,
    refundReceiver,
    nonce,
  );
//   log("signing message using personal_sign for ledger");
  const dataHash = Buffer.from(keccak256(data).slice(2), "hex");
//   log("hash: ", dataHash.toString("hex"));
  const sig = await signer.signMessage(dataHash);
//   log("sig: ", sig);
  return knownVAdjust(adjustV(sig));
};
