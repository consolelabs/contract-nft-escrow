# Mochi NFT Escrow Contract

## Contracts

- Goerli: [0x8D3bb21997f383B3b6aEcE555F87F8D5D5a0587b](https://goerli.etherscan.io/address/0x8D3bb21997f383B3b6aEcE555F87F8D5D5a0587b)
- FTM: [0x4058F40703D696AAD852e9e82F2e3fe45a4f6e36](https://ftmscan.com/address/0x4058F40703D696AAD852e9e82F2e3fe45a4f6e36)

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
