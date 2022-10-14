import {  loadFixture } from "@nomicfoundation/hardhat-network-helpers";
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


  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      const { escrow, owner } = await loadFixture(deployEscrowFixture);

      expect(await escrow.owner()).to.equal(owner.address);
    });
  });

  describe("Create trade offer", function () {
    it("Should create new offer as expected one", async function() {
      const { escrow, owner, otherAccount } = await loadFixture(deployEscrowFixture);
      await escrow.createTradeOffer(otherAccount.address);
      const offer = await escrow.trades(0);
      const expectedOffer = {
        from: owner.address,
        to: otherAccount.address,
        isFromLocked: false,
        isToLocked: false,
        isClosed: false,
    }
      expect(offer.from).to.equal(expectedOffer.from);
      expect(offer.to).to.equal(expectedOffer.to);
      expect(offer.isFromLocked).to.equal(expectedOffer.isFromLocked);
      expect(offer.isToLocked).to.equal(expectedOffer.isToLocked);
      expect(offer.isClosed).to.equal(expectedOffer.isClosed);
    });
  });

  describe("Cancel Trade Offer", function() {
    it("Should cancel offer and returns all deposited items", async function() {
      const { escrow, owner, otherAccount } = await loadFixture(deployEscrowFixture);
      await escrow.createTradeOffer(otherAccount.address);
      await escrow.createTradeOffer(otherAccount.address);

    })
  })
});
