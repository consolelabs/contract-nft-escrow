import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { MochiNFTEscrowV2 } from "../typechain-types";

describe("MochiNFTEscrowV2", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployEscrowFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, addr1, addr2] = await ethers.getSigners();
    const MochiNFTEscrow = await ethers.getContractFactory("MochiNFTEscrowV2");
    const escrow = await MochiNFTEscrow.deploy();
    return { escrow, owner, addr1, addr2 };
  }

  async function deployEscrowFixtureWithNFT() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    const MochiNFTEscrow = await ethers.getContractFactory("MochiNFTEscrowV2");
    const escrow = await MochiNFTEscrow.deploy();
    const ownerTokenIds = ["0", "1", "2"];
    const addr1TokenIds = ["3", "4", "5"];
    const NFT = await ethers.getContractFactory("NFT");
    const nft = await NFT.deploy();
    await nft.deployed();
    for (const id of ownerTokenIds) {
      await nft.safeMint(owner.address);
    }
    for (const id of addr1TokenIds) {
      await nft.safeMint(addr1.address);
    }
    return { escrow, owner, addr1, addr2, nft, ownerTokenIds, addr1TokenIds };
  }

  describe("Deployment", function () {
    it("should set the right owner", async function () {
      const { escrow, owner } = await loadFixture(deployEscrowFixture);

      expect(await escrow.owner()).to.equal(owner.address);
    });
  });

  describe("DepositAll", function () {
    it("should create new trade offer when owner deposit", async function () {
      const { escrow, owner, nft, ownerTokenIds, addr1TokenIds } =
        await loadFixture(deployEscrowFixtureWithNFT);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const haveItems: MochiNFTEscrowV2.RequiredItemStruct[] =
        ownerTokenIds.map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));
      const wantItems: MochiNFTEscrowV2.RequiredItemStruct[] =
        addr1TokenIds.map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));
      for (const tokenId of ownerTokenIds) {
        await nft.approve(escrow.address, tokenId);
      }
      await expect(
        escrow.depositAll(tradeId, owner.address, haveItems, wantItems)
      )
        .to.emit(escrow, "TradeCreated")
        .withArgs(tradeId, owner.address);

      const offer = await escrow.trades(tradeId);
      expect(offer.owner).to.equal(owner.address);
      expect(offer.isClosed).be.false;
      expect(offer.isCancelled).be.false;
    });

    it("should swap when 2 parties deposited", async function () {
      const { escrow, owner, addr1, nft, ownerTokenIds, addr1TokenIds } =
        await loadFixture(deployEscrowFixtureWithNFT);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const haveItems: MochiNFTEscrowV2.RequiredItemStruct[] =
        ownerTokenIds.map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));

      const wantItems: MochiNFTEscrowV2.RequiredItemStruct[] =
        addr1TokenIds.map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));
      for (const tokenId of ownerTokenIds) {
        await nft.approve(escrow.address, tokenId);
      }
      await escrow.depositAll(tradeId, owner.address, haveItems, wantItems);
      for (const tokenId of addr1TokenIds) {
        await nft.connect(addr1).approve(escrow.address, tokenId);
      }
      await expect(
        escrow
          .connect(addr1)
          .depositAll(tradeId, owner.address, haveItems, wantItems)
      )
        .to.emit(escrow, "TradeSuccess")
        .withArgs(tradeId, owner.address, addr1.address);

      expect((await escrow.trades(tradeId)).isClosed).be.true;
      for (const tokenId of ownerTokenIds) {
        expect(await nft.ownerOf(tokenId)).to.equal(addr1.address);
      }
      for (const tokenId of addr1TokenIds) {
        expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
      }
    });
  });

  describe("Cancel Trade Offer", function () {
    describe("When owner deposited and then cancel trade", function () {
      it("Should return items back to owner", async function () {
        const { escrow, owner, addr1, nft, ownerTokenIds, addr1TokenIds } =
          await loadFixture(deployEscrowFixtureWithNFT);
        const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
        const haveItems: MochiNFTEscrowV2.RequiredItemStruct[] =
          ownerTokenIds.map((id) => ({
            tokenAddress: nft.address,
            tokenId: id,
          }));

        const wantItems: MochiNFTEscrowV2.RequiredItemStruct[] =
          addr1TokenIds.map((id) => ({
            tokenAddress: nft.address,
            tokenId: id,
          }));
        for (const tokenId of ownerTokenIds) {
          await nft.approve(escrow.address, tokenId);
        }
        await escrow.depositAll(tradeId, owner.address, haveItems, wantItems);
        await expect(escrow.cancelTradeOffer(tradeId))
          .to.emit(escrow, "TradeCancelled")
          .withArgs(tradeId);
        for (const tokenId of ownerTokenIds) {
          expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
        }
        expect((await escrow.trades(tradeId)).isCancelled).be.true;
        expect((await escrow.trades(tradeId)).isClosed).be.true;
      });
    });

    describe("When owner deposited and then other cancel trade", function () {
      it("should fail", async function () {
        const { escrow, owner, addr1, nft, ownerTokenIds, addr1TokenIds } =
          await loadFixture(deployEscrowFixtureWithNFT);
        const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
        const haveItems: MochiNFTEscrowV2.RequiredItemStruct[] =
          ownerTokenIds.map((id) => ({
            tokenAddress: nft.address,
            tokenId: id,
          }));

        const wantItems: MochiNFTEscrowV2.RequiredItemStruct[] =
          addr1TokenIds.map((id) => ({
            tokenAddress: nft.address,
            tokenId: id,
          }));
        for (const tokenId of ownerTokenIds) {
          await nft.approve(escrow.address, tokenId);
        }
        await escrow.depositAll(tradeId, owner.address, haveItems, wantItems);
        await expect(
          escrow.connect(addr1).cancelTradeOffer(tradeId)
        ).to.revertedWith("only owner");
      });
    });
  });
});
