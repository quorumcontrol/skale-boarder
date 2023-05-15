import { task } from 'hardhat/config'
import fs from 'fs'

task("addresses", "produces the address output. this works because all contracts are deterministic")
  .setAction(async (_, hre) => {
    await hre.run("deploy", {export: "tmp/addresses.json"})
    const json = JSON.parse(fs.readFileSync("tmp/addresses.json").toString())
    const addrs = Object.keys(json.contracts).reduce((memo, contractName) => {
      const contract = json.contracts[contractName]
      console.log(`${contractName}: ${contract.address}`)
      return {
        ...memo,
        [contractName]: contract.address
      }
    }, {} as Record<string, string>)
    fs.writeFileSync("src/addresses.ts", `export default ${JSON.stringify(addrs, null, 2)}`)
    fs.rmSync("tmp/addresses.json")
  })