import type { AppProps } from 'next/app'
import { ChakraProvider } from '@chakra-ui/react'
import '@rainbow-me/rainbowkit/styles.css';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import {
  coinbaseWallet,
  injectedWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';

import {
  connectorsForWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { configureChains, createClient, WagmiConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import wrapWallet from '@/wagmiWrapper';

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
      // rainbowWallet({ chains }),
      // walletConnectWallet({ chains }),
      // coinbaseWallet({ appName: "Demo Skaleboarder", chains }),
    ].map((wallet) => wrapWallet(wallet)),
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
