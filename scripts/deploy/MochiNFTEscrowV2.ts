import hre, { ethers } from "hardhat";

async function main() {
  console.log(`deploying contract...`);
  const MochiNFTEscrowV2 = await ethers.getContractFactory("MochiNFTEscrowV2");
  const escrow = await MochiNFTEscrowV2.deploy();
  await escrow.deployed();
  console.log(`escrow deployed to ${escrow.address}`);

  console.log(`verifying contract...`);
  await hre
    .run("verify:verify", {
      address: escrow.address,
      constructorArguments: [],
    })
    .then(() => {
      console.log(`contract verified success`);
    })
    .catch((e) => {
      console.log(`contract verify failed ${e}`);
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
