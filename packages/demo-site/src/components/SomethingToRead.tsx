import { Box, Heading, Text } from "@chakra-ui/react"
import { BigNumber } from "ethers"
import { useAccount, useContractRead } from "wagmi"
import addresses from "../addresses.json"
import ClientOnly from "./ClientOnly"

const SomethingToRead: React.FC = () => {
    const { address, isConnected } = useAccount()

    const { data, isError, isLoading } = useContractRead({
        address: addresses.contracts.Echo.address as `0x${string}`,
        abi: addresses.contracts.Echo.abi,
        functionName: 'counter',
    })

    if (!isConnected) {
        return null
    }
    return (
        <ClientOnly>
            <Box>
                <Heading>Something To Read</Heading>
                <Text>{address}</Text>
                <Text>Read: {(data as unknown as BigNumber).toNumber()}</Text>
                <Text>Error: {isError.toString()}</Text>
                <Text>isLoading: {isLoading.toString()}</Text>
            </Box>
        </ClientOnly>
    )
}

export default SomethingToRead