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
    it("should create new trade offer when owner deposit first", async function () {
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
      expect(offer.recipient).to.equal(ethers.constants.AddressZero);
      expect(offer.isOwnerDeposited).be.true;
      expect(offer.isRecipientDeposited).be.false;
      expect(offer.isClosed).be.false;
      expect(offer.isOwnerCancelled).be.false;
      expect(offer.isRecipientCancelled).be.false;
    });

    it("should create new trade offer when recipient deposit first", async function () {
      const { escrow, owner, nft, addr1, ownerTokenIds, addr1TokenIds } =
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
      for (const tokenId of addr1TokenIds) {
        await nft.connect(addr1).approve(escrow.address, tokenId);
      }
      await expect(
        escrow
          .connect(addr1)
          .depositAll(tradeId, owner.address, haveItems, wantItems)
      )
        .to.emit(escrow, "TradeCreated")
        .withArgs(tradeId, owner.address);

      const offer = await escrow.trades(tradeId);
      expect(offer.owner).to.equal(owner.address);
      expect(offer.recipient).to.equal(addr1.address);
      expect(offer.isOwnerDeposited).be.false;
      expect(offer.isRecipientDeposited).be.true;
      expect(offer.isClosed).be.false;
      expect(offer.isOwnerCancelled).be.false;
      expect(offer.isRecipientCancelled).be.false;
    });

    it("should swap when owner deposited then recipient deposited", async function () {
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

    it("should swap when recipient deposited then owner deposited", async function () {
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
      for (const tokenId of addr1TokenIds) {
        await nft.connect(addr1).approve(escrow.address, tokenId);
      }
      await escrow
        .connect(addr1)
        .depositAll(tradeId, owner.address, haveItems, wantItems);
      for (const tokenId of ownerTokenIds) {
        await nft.approve(escrow.address, tokenId);
      }
      await expect(
        escrow.depositAll(tradeId, owner.address, haveItems, wantItems)
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
      it("should return items back to owner", async function () {
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
        await escrow.depositAll(tradeId, owner.address, haveItems, wantItems);
        await expect(escrow.cancelTradeOffer(tradeId))
          .to.emit(escrow, "TradeCancelled")
          .withArgs(tradeId, owner.address);
        for (const tokenId of ownerTokenIds) {
          expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
        }
        expect((await escrow.trades(tradeId)).isOwnerCancelled).be.true;
        expect((await escrow.trades(tradeId)).isClosed).be.true;
      });
    });

    describe("When recipient deposited and then owner cancel trade", function () {
      it("should return items back to recipient", async function () {
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
        for (const tokenId of addr1TokenIds) {
          await nft.connect(addr1).approve(escrow.address, tokenId);
        }
        await escrow
          .connect(addr1)
          .depositAll(tradeId, owner.address, haveItems, wantItems);
        await expect(escrow.cancelTradeOffer(tradeId))
          .to.emit(escrow, "TradeCancelled")
          .withArgs(tradeId, owner.address);
        for (const tokenId of addr1TokenIds) {
          expect(await nft.ownerOf(tokenId)).to.equal(addr1.address);
        }
        expect((await escrow.trades(tradeId)).isOwnerCancelled).be.true;
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
        ).to.revertedWith("only owner or recipient");
      });
    });
  });

  describe("Get trade ids of user", function () {
    it("should return trade ids in which, user deposited", async function () {
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
      await escrow
        .connect(addr1)
        .depositAll(tradeId, owner.address, haveItems, wantItems);
      expect((await escrow.tradeIds(owner.address))[0]).to.equal(tradeId);
      expect((await escrow.tradeIds(addr1.address))[0]).to.equal(tradeId);
    });
  });
});
