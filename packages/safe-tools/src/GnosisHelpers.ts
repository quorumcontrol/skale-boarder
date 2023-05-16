import {
  Signer,
  Contract,
  PopulatedTransaction,
  constants,
  PayableOverrides,
  BytesLike,
  BigNumber,
} from "ethers";
import { signer, OPERATION } from "./txSigner";
import { GnosisSafeL2 } from "../typechain-types";

const log = console.log

export const MULTI_SEND_ADDR = "0x8D29bE29923b68abfDD21e541b9374737B49cdAD";

type Address = string

export type ExecParams = Parameters<GnosisSafeL2["execTransaction"]>;

export async function safeFromPopulated(
  safe: GnosisSafeL2,
  nonce: BigNumber,
  userSigner: Signer,
  to: Address,
  data: BytesLike,
  operation: OPERATION,
  overrides?: PayableOverrides,
): Promise<[PopulatedTransaction, ExecParams]> {

  let value = constants.Zero;
  if (overrides && overrides.hasOwnProperty("value")) {
    value = BigNumber.from(await overrides.value);
  }

  const sig = await signer(
    safe,
    userSigner,
    to,
    value,
    data,
    operation,
    0,
    0,
    0,
    constants.AddressZero,
    constants.AddressZero,
    nonce,
  );

  const execArgs: ExecParams = [
    to,
    value.toHexString(),
    data,
    operation,
    0,
    0,
    0,
    constants.AddressZero,
    constants.AddressZero,
    sig,
  ];

  let txArgs: ExecParams = [...execArgs];
  if (overrides) {
    delete overrides.value;
    txArgs.push(overrides);
  }

  return [await safe.populateTransaction.execTransaction(...txArgs), execArgs];
}
