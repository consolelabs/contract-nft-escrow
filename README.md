# Mochi NFT Escrow Contract

## Contracts

| Name           | Goerli address                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| MochiNFTEscrow | [0xeB5CD31F7e1667832C4cD46a348a724ED10AE296](https://goerli.etherscan.io/address/0xeB5CD31F7e1667832C4cD46a348a724ED10AE296) |

## How to run project

1. Install deps with `npm install`
2. To run unit test, use command `npx hardhat test`
3. Fill in .env file (ref from .env.example)
4. Deploy contracts with `npx hardhat run scripts/deploy.ts`

## Note

- Still in experiment. DYOR!

## Todo list

### Feature

- [x] Create trade offer
- [x] Cancel offer
- [x] Deposit
- [x] Withdraw
- [x] Lock
- [x] Unlock

### Test

- [x] Deploy
- [x] Swap
- [x] Withdraw
- [x] Cancel
