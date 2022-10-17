import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("MochiNFTEscrow", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployEscrowFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();
    const MochiNFTEscrow = await ethers.getContractFactory("MochiNFTEscrow");
    const escrow = await MochiNFTEscrow.deploy();
    return { escrow, owner, otherAccount };
  }

  async function deployEscrowFixtureWithNFT() {
    const [owner, otherAccount] = await ethers.getSigners();
    const MochiNFTEscrow = await ethers.getContractFactory("MochiNFTEscrow");
    const escrow = await MochiNFTEscrow.deploy();
    const ownerTokenIds = ["0", "1", "2"];
    const otherTokenIds = ["3", "4", "5"];
    const NFT = await ethers.getContractFactory("NFT");
    const nft = await NFT.deploy();
    await nft.deployed();
    for (const id of ownerTokenIds) {
      await nft.safeMint(owner.address);
    }
    for (const id of otherTokenIds) {
      await nft.safeMint(otherAccount.address);
    }
    return { escrow, owner, otherAccount, nft, ownerTokenIds, otherTokenIds };
  }

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { escrow, owner } = await loadFixture(deployEscrowFixture);

      expect(await escrow.owner()).to.equal(owner.address);
    });
  });

  describe("Create trade offer", function () {
    it("Should create new offer as expected one", async function () {
      const { escrow, owner, otherAccount } = await loadFixture(
        deployEscrowFixture
      );
      await escrow.createTradeOffer(otherAccount.address);
      const offer = await escrow.trades(0);
      const expectedOffer = {
        from: owner.address,
        to: otherAccount.address,
        isFromLocked: false,
        isToLocked: false,
        isClosed: false,
      };
      expect(offer.from).to.equal(expectedOffer.from);
      expect(offer.to).to.equal(expectedOffer.to);
      expect(offer.isFromLocked).to.equal(expectedOffer.isFromLocked);
      expect(offer.isToLocked).to.equal(expectedOffer.isToLocked);
      expect(offer.isClosed).to.equal(expectedOffer.isClosed);
    });
  });

  describe("Swap", function () {
    describe("When both deposited and lock", function () {
      it("Should swap item", async function () {
        const {
          escrow,
          owner,
          otherAccount,
          nft,
          ownerTokenIds,
          otherTokenIds,
        } = await loadFixture(deployEscrowFixtureWithNFT);
        const tradeId = 0;
        await escrow.createTradeOffer(otherAccount.address);

        for (const tokenId of ownerTokenIds) {
          await nft.approve(escrow.address, tokenId);
        }
        await escrow.deposit(tradeId, nft.address, ownerTokenIds);

        for (const tokenId of otherTokenIds) {
          await nft.connect(otherAccount).approve(escrow.address, tokenId);
        }
        await escrow
          .connect(otherAccount)
          .deposit(tradeId, nft.address, otherTokenIds);

        await escrow.lockTrade(tradeId);
        await escrow.connect(otherAccount).lockTrade(tradeId);
        expect(await nft.ownerOf("4")).to.equal(owner.address);
      });
    });
  });

  describe("Withdraw", function () {
    it("Should withdraw item to owner set the trade state of both to unlock", async function () {
      const { escrow, owner, otherAccount, nft, ownerTokenIds, otherTokenIds } =
        await loadFixture(deployEscrowFixtureWithNFT);
      const tradeId = 0;
      await escrow.createTradeOffer(otherAccount.address);

      for (const tokenId of ownerTokenIds) {
        await nft.approve(escrow.address, tokenId);
      }
      await escrow.deposit(tradeId, nft.address, ownerTokenIds);
      for (const tokenId of otherTokenIds) {
        await nft.connect(otherAccount).approve(escrow.address, tokenId);
      }
      await escrow
        .connect(otherAccount)
        .deposit(tradeId, nft.address, otherTokenIds);

      await escrow.lockTrade(tradeId);

      await escrow
        .connect(otherAccount)
        .withdraw(tradeId, nft.address, otherTokenIds);

      expect(await nft.ownerOf(otherTokenIds[0])).to.equal(
        otherAccount.address
      );
      expect((await escrow.trades(tradeId)).isFromLocked).be.false;
      expect((await escrow.trades(tradeId)).isToLocked).be.false;
    });
  });

  describe("Cancel Trade Offer", function () {
    describe("When both deposited and one side cancel trade", function () {
      it("Should return items back to owner", async function () {
        const {
          escrow,
          owner,
          otherAccount,
          nft,
          ownerTokenIds,
          otherTokenIds,
        } = await loadFixture(deployEscrowFixtureWithNFT);
        const tradeId = 0;
        await escrow.createTradeOffer(otherAccount.address);

        for (const tokenId of ownerTokenIds) {
          await nft.approve(escrow.address, tokenId);
        }
        await escrow.deposit(tradeId, nft.address, ownerTokenIds);

        for (const tokenId of otherTokenIds) {
          await nft.connect(otherAccount).approve(escrow.address, tokenId);
        }
        await escrow
          .connect(otherAccount)
          .deposit(tradeId, nft.address, otherTokenIds);

        await escrow.cancelTradeOffer(tradeId);
        expect(await nft.ownerOf(ownerTokenIds[0])).to.equal(owner.address);
        expect(await nft.ownerOf(otherTokenIds[0])).to.equal(
          otherAccount.address
        );
        expect((await escrow.trades(tradeId)).isClosed).be.true;
      });
    });
  });
});
