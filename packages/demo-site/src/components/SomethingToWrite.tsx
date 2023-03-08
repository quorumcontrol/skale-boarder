import { Box, Button, Heading, Text, VStack } from "@chakra-ui/react"
import { useAccount, useContractRead, useContractWrite, usePrepareContractWrite } from "wagmi"
import addresses from "../addresses.json"
import ClientOnly from "./ClientOnly"

const SomethingToWrite: React.FC = () => {
    const { isConnected } = useAccount()

    const { config } = usePrepareContractWrite({
        address: addresses.contracts.Echo.address as `0x${string}`,
        abi: addresses.contracts.Echo.abi,
        functionName: 'increment',
    })

    const { data, isSuccess, isLoading, write } = useContractWrite(config)
    // console.log("write: ", write, config)

    if (!isConnected) {
        return null
    }
    return (
        <ClientOnly>
            <VStack>
                <Heading size="md">Write Contracts</Heading>
                <Button disabled={!write} onClick={() => write?.()}>Increment</Button>
                {isLoading && <div>Sending Transaction...</div>}
                {isSuccess && <div>Transaction: {JSON.stringify(data)}</div>}
            </VStack>
        </ClientOnly>
    )
}

export default SomethingToWrite