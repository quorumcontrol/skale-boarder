import type { AppProps } from 'next/app'
import { ChakraProvider } from '@chakra-ui/react'
import ethers, { BigNumber, providers } from "ethers"
import '@rainbow-me/rainbowkit/styles.css';
import { jsonRpcProvider } from 'wagmi/providers/jsonRpc'
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import {
  connectorsForWallets,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import { configureChains, createClient, WagmiConfig } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import { createChain, RainbowKitWalletWrapper, WagmiWrapperConfig } from '@skaleboarder/rainbowkit';
import addresses from "../addresses.json"


const skaleMainnet = createChain({
  id: BigNumber.from('0x3d91725c').toNumber(),
  name: 'Crypto Rome',
  rpcUrls: {
    default: {
      http: ["https://mainnet.skalenodes.com/v1/haunting-devoted-deneb"],
      webSocket: ["wss://mainnet.skalenodes.com/v1/ws/haunting-devoted-deneb"],
    },
    public: {
      http: ["https://mainnet.skalenodes.com/v1/haunting-devoted-deneb"],
      webSocket: ["wss://mainnet.skalenodes.com/v1/ws/haunting-devoted-deneb"],
    }
  },
  explorer: "https://haunting-devoted-deneb.explorer.mainnet.skalenodes.com/"
})

const localDev = createChain({
  id: 31337,
  name: 'Local Rome',
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
    public: {
      http: ['http://localhost:8545'],
    }
  },
  explorer: "http://no.explorer"
})

// you can setup a 
const skaleProvider = new providers.StaticJsonRpcProvider(localDev.rpcUrls.default.http[0])

// const wrapper = new RainbowKitWalletWrapper({
//     ethers,
//     provider: skaleProvider,
//     chainId: addresses.chainId,
//     deploys: addresses.contracts,
//     faucet: async (address, _signer) => {
//       const resp = await fetch(`/api/faucet`, { body: JSON.stringify({ address }), method: "POST" })
//       const json = await resp.json()
//       console.log("resp: ", json)
//     },
// })

const wrapperConfigs:WagmiWrapperConfig = {
  ethers,
  provider: skaleProvider,
  chainId:  localDev.id.toString(),
  deploys: addresses.contracts,
  faucet: async (address, _signer) => {
      const resp = await fetch(`/api/localFaucet`, { body: JSON.stringify({ address }), method: "POST" })
      const json = await resp.json()
      console.log("resp: ", json)
    },
}

const wrapper = new RainbowKitWalletWrapper(wrapperConfigs)

const { chains, provider } = configureChains(
  [mainnet, polygon, optimism, arbitrum, skaleMainnet],
  [
    jsonRpcProvider({
      rpc: (_chain) => ({
        http: skaleProvider.connection.url,
      }),
    }),
  ]
);

const connectors = () => {
  const connects = connectorsForWallets([
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet({ chains, shimDisconnect: true }),
        metaMaskWallet({ chains, shimDisconnect: true }),
        coinbaseWallet({ appName: "Empire Gambit", chains }),
        walletConnectWallet({ chains }),
      ].map((wallet) => wrapper.wrapWallet(wallet)),
    },
  ])

  return connects()

  // return connects().concat([
  //   new WagmiWrapper(wrapperConfigs).wrapConnector(new Web3AuthConnector({ chains: [mainnet], options: {} })),
  // ])
}

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
