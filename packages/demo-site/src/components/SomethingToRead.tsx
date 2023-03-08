import { Box, Heading, Text, VStack } from "@chakra-ui/react"
import { BigNumber } from "ethers"
import { useEffect } from "react"
import { useAccount, useContractRead, useInfiniteQuery } from "wagmi"
import addresses from "../addresses.json"
import ClientOnly from "./ClientOnly"

const SomethingToRead: React.FC = () => {
    const { address, isConnected } = useAccount()

    const { data, isError, isLoading, refetch } = useContractRead({
        address: addresses.contracts.Echo.address as `0x${string}`,
        abi: addresses.contracts.Echo.abi,
        functionName: 'counter',
    })

    useEffect(() => {
        if (!isConnected) {
            return
        }
        const interval = setInterval(refetch, 3000)
        return () => clearInterval(interval)
    })

    if (!isConnected) {
        return null
    }
    return (
        <ClientOnly>
            <VStack>
                <Heading size="md">Read contracts</Heading>
                <Text>Counter: {(data as unknown as BigNumber)?.toNumber()}</Text>
                <Text>isLoading: {isLoading.toString()}</Text>
                {isError && <Text>isError: {isError.toString()}</Text>}
            </VStack>
        </ClientOnly>
    )
}

export default SomethingToRead