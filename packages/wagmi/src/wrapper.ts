import {
  SafeRelayer,
  SafeSignerOptions,
  UserRelayerProps,
} from "@skaleboarder/safe-tools";
import { ethers, providers, Signer } from "ethers";
import { Connector } from "wagmi";

type Address = string;

interface ContractDeploy {
  address: Address;
}

export interface WagmiWrapperConfig {
  ethers: typeof ethers;
  provider: providers.Provider;
  chainId: string;
  deploys: {
    GnosisSafe: ContractDeploy;
    GnosisSafeProxyFactory: ContractDeploy;
    MultiSend: ContractDeploy;
    MultiSendCallOnly: ContractDeploy;
    CompatibilityFallbackHandler: ContractDeploy;
    SignMessageLib: ContractDeploy;
    CreateCall: ContractDeploy;
    EnglishOwnerAdder: ContractDeploy;
    WalletDeployer: ContractDeploy;
  };
  faucet: UserRelayerProps["faucet"];
  signerOptions?: SafeSignerOptions;
  localStorage?: UserRelayerProps["localStorage"];
}

export class WagmiWrapper {
  private config: WagmiWrapperConfig;

  constructor(config: WagmiWrapperConfig) {
    this.config = config;
  }

  // create contract configs
  private contractConfigs() {
    return {
      [this.config.chainId]: {
        safeMasterCopyAddress: this.config.deploys.GnosisSafe.address,
        safeProxyFactoryAddress:
          this.config.deploys.GnosisSafeProxyFactory.address,
        multiSendAddress: this.config.deploys.MultiSend.address,
        multiSendCallOnlyAddress: this.config.deploys.MultiSendCallOnly.address,
        fallbackHandlerAddress:
          this.config.deploys.CompatibilityFallbackHandler.address,
        signMessageLibAddress: this.config.deploys.SignMessageLib.address,
        createCallAddress: this.config.deploys.CreateCall.address,
      },
    };
  }

  private createRelayer = (signer: Signer) => {
    return new SafeRelayer({
      ethers,
      signer,
      EnglishOwnerAdderAddress: this.config.deploys.EnglishOwnerAdder.address,
      walletDeployerAddress: this.config.deploys.WalletDeployer.address,
      networkConfig: this.contractConfigs(),
      provider: this.config.provider,
      localStorage: this.config.localStorage,
      faucet: this.config.faucet,
      signerOptions: this.config.signerOptions,
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
            console.log("get getSigner");
            return () => {
              if (signerPromise) {
                return signerPromise;
              }
              signerPromise = (async () => {
                const original = await target.getSigner();
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
