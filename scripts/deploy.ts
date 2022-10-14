import hre, { ethers } from "hardhat";

async function main() {
  const MochiNFTEscrow = await ethers.getContractFactory("MochiNFTEscrow");
  const escrow = await MochiNFTEscrow.deploy();
  await escrow.deployed();
  console.log(`escrow deployed to ${escrow.address}`);

  await hre.run("verify:verify", {
    address: escrow.address,
    constructorArguments: [],
  });

  console.log(`contract verified success`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
