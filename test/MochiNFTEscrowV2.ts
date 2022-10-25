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

  describe("Create trade offer", function () {
    it("should create new offer as expected one", async function () {
      const { escrow, owner, addr1 } = await loadFixture(deployEscrowFixture);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "1",
        },
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "2",
        },
      ];
      const toItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "1",
        },
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "2",
        },
      ];
      await escrow.createTradeOffer(
        tradeId,
        owner.address,
        addr1.address,
        fromItems,
        toItems
      );
      const offer = await escrow.trades(tradeId);
      const requiredFromItems = await escrow.requiredItemsOf(
        tradeId,
        owner.address
      );
      const requiredToItems = await escrow.requiredItemsOf(
        tradeId,
        addr1.address
      );
      const expectedOffer = {
        from: owner.address,
        to: addr1.address,
        isClosed: false,
        isFromCancelled: false,
        isToCancelled: false,
      };
      expect(offer.from).to.equal(expectedOffer.from);
      expect(offer.to).to.equal(expectedOffer.to);
      expect(offer.isClosed).to.equal(expectedOffer.isClosed);
      expect(offer.isFromCancelled).to.equal(expectedOffer.isFromCancelled);
      expect(offer.isToCancelled).to.equal(expectedOffer.isToCancelled);
      for (let index = 0; index < fromItems.length; index++) {
        const expectedItem = fromItems[index];
        expect(requiredFromItems[index].tokenAddress).to.equal(
          expectedItem.tokenAddress
        );
        expect(requiredFromItems[index].tokenId).to.equal(expectedItem.tokenId);
      }
      for (let index = 0; index < toItems.length; index++) {
        const expectedItem = toItems[index];
        expect(requiredToItems[index].tokenAddress).to.equal(
          expectedItem.tokenAddress
        );
        expect(requiredToItems[index].tokenId).to.equal(expectedItem.tokenId);
      }
      expect(escrow.createTradeOffer);
    });

    it("should emit TradeCreated events", async function () {
      const { escrow, owner, addr1 } = await loadFixture(deployEscrowFixture);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "1",
        },
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "2",
        },
      ];
      const toItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "1",
        },
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "2",
        },
      ];
      await expect(
        escrow.createTradeOffer(
          tradeId,
          owner.address,
          addr1.address,
          fromItems,
          toItems
        )
      )
        .to.emit(escrow, "TradeCreated")
        .withArgs(tradeId, owner.address, addr1.address);
    });

    it("should fail if the caller not from relevant party", async function () {
      const { escrow, owner, addr1, addr2 } = await loadFixture(
        deployEscrowFixture
      );

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "1",
        },
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "2",
        },
      ];
      const toItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "1",
        },
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "2",
        },
      ];
      await expect(
        escrow
          .connect(addr2)
          .createTradeOffer(
            tradeId,
            owner.address,
            addr1.address,
            fromItems,
            toItems
          )
      ).to.be.revertedWith("you are not relevant");
    });

    it("should fail if the tradeId already exist", async function () {
      const { escrow, owner, addr1 } = await loadFixture(deployEscrowFixture);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "1",
        },
        {
          tokenAddress: "0x5417A03667AbB6A059b3F174c1F67b1E83753046",
          tokenId: "2",
        },
      ];
      const toItems: MochiNFTEscrowV2.RequiredItemStruct[] = [
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "1",
        },
        {
          tokenAddress: "0xAEeE56fe367381f29510C27F1Dae815E9591d60a",
          tokenId: "2",
        },
      ];
      await escrow.createTradeOffer(
        tradeId,
        owner.address,
        addr1.address,
        fromItems,
        toItems
      );
      await expect(
        escrow.createTradeOffer(
          tradeId,
          owner.address,
          addr1.address,
          fromItems,
          toItems
        )
      ).to.be.revertedWith("trade id already exists");
    });
  });

  describe("DepositAll", function () {
    it("should deposit all required items", async function () {
      const { escrow, owner, addr1, nft, ownerTokenIds, addr1TokenIds } =
        await loadFixture(deployEscrowFixtureWithNFT);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] =
        ownerTokenIds.map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));

      const toItems: MochiNFTEscrowV2.RequiredItemStruct[] = addr1TokenIds.map(
        (id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        })
      );
      await escrow.createTradeOffer(
        tradeId,
        owner.address,
        addr1.address,
        fromItems,
        toItems
      );
      for (const tokenId of ownerTokenIds) {
        await nft.approve(escrow.address, tokenId);
      }
      await escrow.depositAll(tradeId);
      for (const tokenId of ownerTokenIds) {
        expect(await nft.ownerOf(tokenId)).to.equal(escrow.address);
      }
    });

    it("should swap when 2 parties deposited", async function () {
      const { escrow, owner, addr1, nft, ownerTokenIds, addr1TokenIds } =
        await loadFixture(deployEscrowFixtureWithNFT);

      const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
      const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] =
        ownerTokenIds.map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));

      const toItems: MochiNFTEscrowV2.RequiredItemStruct[] = addr1TokenIds
        .slice(1)
        .map((id) => ({
          tokenAddress: nft.address,
          tokenId: id,
        }));
      await escrow.createTradeOffer(
        tradeId,
        owner.address,
        addr1.address,
        fromItems,
        toItems
      );
      for (const tokenId of ownerTokenIds) {
        await nft.approve(escrow.address, tokenId);
      }
      await escrow.depositAll(tradeId);
      for (const tokenId of addr1TokenIds) {
        await nft.connect(addr1).approve(escrow.address, tokenId);
      }
      await escrow.connect(addr1).depositAll(tradeId);
      expect((await escrow.trades(tradeId)).isClosed).be.true;
    });
  });

  describe("Cancel Trade Offer", function () {
    describe("When one deposited all and one side cancel trade", function () {
      it("Should return items back to owner", async function () {
        const { escrow, owner, addr1, nft, ownerTokenIds, addr1TokenIds } =
          await loadFixture(deployEscrowFixtureWithNFT);
        const tradeId = "33cd0862-eb15-446a-ada2-e5cfaf88b42e";
        const fromItems: MochiNFTEscrowV2.RequiredItemStruct[] =
          ownerTokenIds.map((id) => ({
            tokenAddress: nft.address,
            tokenId: id,
          }));

        const toItems: MochiNFTEscrowV2.RequiredItemStruct[] =
          addr1TokenIds.map((id) => ({
            tokenAddress: nft.address,
            tokenId: id,
          }));
        await escrow.createTradeOffer(
          tradeId,
          owner.address,
          addr1.address,
          fromItems,
          toItems
        );

        for (const tokenId of ownerTokenIds) {
          await nft.approve(escrow.address, tokenId);
        }
        await escrow.depositAll(tradeId);

        await escrow.connect(addr1).cancelTradeOffer(tradeId);
        for (const tokenId of ownerTokenIds) {
          expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
        }
        // Cancel trigger from from side
        expect((await escrow.trades(tradeId)).isFromCancelled).be.false;
        expect((await escrow.trades(tradeId)).isToCancelled).be.true;
        expect((await escrow.trades(tradeId)).isClosed).be.true;
      });
    });
  });
});
