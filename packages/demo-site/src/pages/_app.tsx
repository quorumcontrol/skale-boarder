import type { AppProps } from 'next/app'
import { ChakraProvider } from '@chakra-ui/react'
import ethers, { providers } from "ethers"
import '@rainbow-me/rainbowkit/styles.css';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {
  connectorsForWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { configureChains, createClient, WagmiConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import { RainbowKitWalletWrapper } from '@skaleboarder/rainbowkit';
import addresses from "../addresses.json"


const skaleProvider = new providers.StaticJsonRpcProvider("http://localhost:8545/")

const wrapper = new RainbowKitWalletWrapper({
    ethers,
    provider: skaleProvider,
    chainId: addresses.chainId,
    deploys: addresses.contracts,
    faucet: async (address, _signer) => {
      const resp = await fetch(`/api/faucet`, { body: JSON.stringify({ address }), method: "POST" })
      const json = await resp.json()
      console.log("resp: ", json)
    },
})

const { chains, provider } = configureChains(
  [mainnet, polygon, optimism, arbitrum],
  [
    jsonRpcProvider({
      rpc: (chain) => ({
        http: `http://localhost:8545`,
      }),
    }),
  ]
);

const connectors = connectorsForWallets([
  {
    groupName: 'Recommended',
    wallets: [
      injectedWallet({ chains }),
      metaMaskWallet({ chains }),
      // rainbowWallet({ chains }),
      // walletConnectWallet({ chains }),
      // coinbaseWallet({ appName: "Demo Skaleboarder", chains }),
    ].map((wallet) => wrapper.wrapWallet(wallet)),
  },
]);

const wagmiClient = createClient({
  autoConnect: false,
  connectors: connectors,
  provider
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider>
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains}>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </WagmiConfig>
    </ChakraProvider>
  )
}
