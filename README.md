# Mochi NFT Escrow Contract

## Contracts

| Name           | Goerli address                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| MochiNFTEscrow | [0x81F17c08De533Aa44e7C8Fe32F6f444D3CC65EeD](https://goerli.etherscan.io/address/0x81F17c08De533Aa44e7C8Fe32F6f444D3CC65EeD) |

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
- [x] Get user trades
- [x] Get user deposited items

### Test

- [x] Deploy
- [x] Swap
- [x] Withdraw
- [x] Cancel
- [x] Get user trades
- [x] Get user deposited items
