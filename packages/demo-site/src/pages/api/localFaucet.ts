// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { ethers, providers } from 'ethers'
import type { NextApiRequest, NextApiResponse } from 'next'

// this is OK that this is checked in - it's account #2 from the hardhat local node
const pk = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"

const signer = new ethers.Wallet(pk, new providers.StaticJsonRpcProvider("http://127.0.0.1:8545"))

type Data = {
  transactionHash: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const { address } = JSON.parse(req.body)

  const tx = await signer.sendTransaction({
    to: address,
    value: ethers.utils.parseEther("1.0") 
  })


  res.status(200).json({ transactionHash: tx.hash })
}
