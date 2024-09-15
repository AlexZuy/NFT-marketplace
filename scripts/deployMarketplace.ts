import {ethers, upgrades} from 'hardhat'

async function main() {
  const fee = 20 // 2%
  const factory = await ethers.getContractFactory('NFTMarketplace')
  const contracr = await upgrades.deployProxy(factory, [
    fee
  ])

  await contracr.waitForDeployment();

  const proxyAddress = await contracr.getAddress();
  const implementAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress)

  console.log("proxyAddress ", proxyAddress);
  console.log("implementAddress ", implementAddress);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
})