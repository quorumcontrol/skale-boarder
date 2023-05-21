import {
  Signer,
  Contract,
  PopulatedTransaction,
  constants,
  PayableOverrides,
  BytesLike,
  BigNumber,
  VoidSigner,
  utils,
} from "ethers";
import { signer, OPERATION } from "./txSigner";
import { GnosisSafeL2, GnosisSafeL2__factory } from "../typechain-types";
import addresses from "./addresses";

const log = console.log

export const MULTI_SEND_ADDR = "0x8D29bE29923b68abfDD21e541b9374737B49cdAD";

type Address = string

export type ExecParams = Parameters<GnosisSafeL2["execTransaction"]>;

export async function safeTxFromPopulated(
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

// saves a call to GnosisSafeProxyFactory#proxyCreationCode()
const proxyCreationCode = "0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea2646970667358221220d1429297349653a4918076d650332de1a1068c5f3e07c5c82360c277770b955264736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564"

// this is the signature of "setup()"
const setupFunctionEncoded = "0xba0bba40"

const voidMasterCopy = GnosisSafeL2__factory.connect(constants.AddressZero, new VoidSigner(""))

export const safeAddress = async (user: string, chainId: number) => {

  const setupTx = await voidMasterCopy.populateTransaction.setup([user], 1, addresses.SafeSetup, setupFunctionEncoded, addresses.CompatibilityFallbackHandler, constants.AddressZero, 0, constants.AddressZero)
  if (!setupTx.data) {
      throw new Error("no setup data")
  }
  const setupData = setupTx.data

  const salt = utils.keccak256(utils.solidityPack(['bytes', 'uint256'], [utils.keccak256(setupData), chainId]))
  const initCode = utils.solidityKeccak256(['bytes', 'bytes'], [proxyCreationCode, utils.defaultAbiCoder.encode(['address'], [addresses.GnosisSafe])])
  
  return utils.getCreate2Address(addresses.GnosisSafeProxyFactory, salt, initCode)
}