# Mochi NFT Escrow Contract

## Contracts

### MochiNFTEscrowV1

- Goerli: [0x8D3bb21997f383B3b6aEcE555F87F8D5D5a0587b](https://goerli.etherscan.io/address/0x8D3bb21997f383B3b6aEcE555F87F8D5D5a0587b)
- FTM: [0x4058F40703D696AAD852e9e82F2e3fe45a4f6e36](https://ftmscan.com/address/0x4058F40703D696AAD852e9e82F2e3fe45a4f6e36)

### MochiNFTEscrowV2

- Goerli: [0xf4D13b030abFc23D423d9102aa6A41E0E41C02d8](https://goerli.etherscan.io/address/0xf4D13b030abFc23D423d9102aa6A41E0E41C02d8)
- FTM: [0x1b8c2fd7EA1D65F15A5588AC5434b5ffa4273f01](https://ftmscan.com/address/0x1b8c2fd7EA1D65F15A5588AC5434b5ffa4273f01)

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
