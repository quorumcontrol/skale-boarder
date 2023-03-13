import React, { createContext, useContext } from "react"
import { WagmiWrapperConfig } from "../wrapper"

const safeProviderContext = createContext({} as WagmiWrapperConfig)

export const useSafeConfig = () => {
    return useContext(safeProviderContext)
}

export const SafeProvider:React.FC<{config: WagmiWrapperConfig, children?:JSX.Element}> = ({config, children}) => {
    return (
        <safeProviderContext.Provider value={config}>
            {children}
        </safeProviderContext.Provider>
    )
}
