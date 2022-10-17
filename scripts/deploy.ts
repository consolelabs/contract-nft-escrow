import hre, { ethers } from "hardhat";

async function main() {
  console.log(`deploying contract...`);
  const MochiNFTEscrow = await ethers.getContractFactory("MochiNFTEscrow");
  const escrow = await MochiNFTEscrow.deploy();
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
    .catch(() => {
      console.log(`contract already verified`);
    });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
