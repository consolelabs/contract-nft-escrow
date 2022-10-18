import hre, { ethers } from "hardhat";

async function main() {
  console.log(`deploying contract...`);
  const NFT = await ethers.getContractFactory("NFT");
  const nft = await NFT.deploy();
  await nft.deployed();
  console.log(`nft deployed to ${nft.address}`);

  console.log(`verifying contract...`);
  await hre.run("verify:verify", {
    address: nft.address,
    constructorArguments: [],
  });
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
