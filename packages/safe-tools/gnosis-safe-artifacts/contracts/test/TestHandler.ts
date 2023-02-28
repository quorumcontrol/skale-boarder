/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumber,
  BytesLike,
  CallOverrides,
  PopulatedTransaction,
  Signer,
  utils,
} from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type {
  TypedEventFilter,
  TypedEvent,
  TypedListener,
  OnEvent,
  PromiseOrValue,
} from "../../../../common";

export interface TestHandlerInterface extends utils.Interface {
  functions: {
    "dudududu()": FunctionFragment;
  };

  getFunction(nameOrSignatureOrTopic: "dudududu"): FunctionFragment;

  encodeFunctionData(functionFragment: "dudududu", values?: undefined): string;

  decodeFunctionResult(functionFragment: "dudududu", data: BytesLike): Result;

  events: {};
}

export interface TestHandler extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  interface: TestHandlerInterface;

  queryFilter<TEvent extends TypedEvent>(
    event: TypedEventFilter<TEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TEvent>>;

  listeners<TEvent extends TypedEvent>(
    eventFilter?: TypedEventFilter<TEvent>
  ): Array<TypedListener<TEvent>>;
  listeners(eventName?: string): Array<Listener>;
  removeAllListeners<TEvent extends TypedEvent>(
    eventFilter: TypedEventFilter<TEvent>
  ): this;
  removeAllListeners(eventName?: string): this;
  off: OnEvent<this>;
  on: OnEvent<this>;
  once: OnEvent<this>;
  removeListener: OnEvent<this>;

  functions: {
    dudududu(
      overrides?: CallOverrides
    ): Promise<[string, string] & { sender: string; manager: string }>;
  };

  dudududu(
    overrides?: CallOverrides
  ): Promise<[string, string] & { sender: string; manager: string }>;

  callStatic: {
    dudududu(
      overrides?: CallOverrides
    ): Promise<[string, string] & { sender: string; manager: string }>;
  };

  filters: {};

  estimateGas: {
    dudududu(overrides?: CallOverrides): Promise<BigNumber>;
  };

  populateTransaction: {
    dudududu(overrides?: CallOverrides): Promise<PopulatedTransaction>;
  };
}
