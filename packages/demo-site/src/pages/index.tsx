import Head from 'next/head'
import { Text, VStack } from '@chakra-ui/react'
import { ConnectButton } from '@rainbow-me/rainbowkit';
import SomethingToRead from '@/components/SomethingToRead';

export default function Home() {
  return (
    <>
      <Head>
        <title>Demo Skaleboarder App</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <VStack>
        <Text>hi</Text>
        <ConnectButton />
        <SomethingToRead />
      </VStack>
    </>
  )
}