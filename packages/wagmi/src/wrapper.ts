import {
  addresses,
  SafeRelayer,
  UserRelayerProps,
} from "@skaleboarder/safe-tools";
import { Connector } from "wagmi";
import type { ethers, providers, Signer } from "ethers";

type Address = string;

interface ContractDeploy {
  address: Address;
}

export interface WagmiWrapperConfig {
  ethers: typeof ethers;
  provider: providers.Provider;
  faucet: UserRelayerProps["faucet"];
  deploys?: Partial<{
    GnosisSafe: ContractDeploy;
    GnosisSafeProxyFactory: ContractDeploy;
    MultiSend: ContractDeploy;
    MultiSendCallOnly: ContractDeploy;
    CompatibilityFallbackHandler: ContractDeploy;
    SignMessageLib: ContractDeploy;
    CreateCall: ContractDeploy;
    EnglishOwnerAdder: ContractDeploy;
    WalletDeployer: ContractDeploy;
  }>;
  localStorage?: UserRelayerProps["localStorage"];
}

export class WagmiWrapper {
  private config: WagmiWrapperConfig;

  constructor(config: WagmiWrapperConfig) {
    this.config = config;
  }

  private createRelayer = (signer: Signer) => {
    return new SafeRelayer({
      ethers: this.config.ethers,
      signer,
      EnglishOwnerAdderAddress:
        this.config.deploys?.EnglishOwnerAdder?.address ||
        addresses.default.EnglishOwnerAdder,
      walletDeployerAddress: this.config.deploys?.WalletDeployer?.address ||
        addresses.default.WalletDeployer,
      provider: this.config.provider,
      localStorage: this.config.localStorage,
      faucet: this.config.faucet,
    });
  };

  wrapConnector(connector: Connector) {
    // console.log("wrapping", connector)
    let signerPromise: Promise<Signer>;

    const proxy = new Proxy(connector, {
      get: (target, prop) => {
        switch (prop) {
          case "getProvider":
            // console.log('get provider: ', this.config.provider)
            return async () => {
              return this.config.provider;
            };
          case "getSigner":
            return () => {
              if (signerPromise) {
                return signerPromise;
              }
              signerPromise = (async () => {
                const original = await target.getSigner();
                console.log("original signer: ", original);
                const relayer = this.createRelayer(original);
                return relayer.wrappedSigner();
              })();
              return signerPromise;
            };
          default:
            const original = (target as any)[prop];
            if (typeof original === "function") {
              return original.bind(target);
            }
            return original;
        }
      },
    });
    return proxy;
  }
}
