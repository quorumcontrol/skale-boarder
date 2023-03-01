import { Box, Button, Heading, Text } from "@chakra-ui/react"
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
            <Box>
                <Heading>Something To Write</Heading>
                <Button disabled={!write} onClick={() => write?.()}>Increment</Button>
                {isLoading && <div>Check Wallet</div>}
                {isSuccess && <div>Transaction: {JSON.stringify(data)}</div>}
            </Box>
        </ClientOnly>
    )
}

export default SomethingToWrite