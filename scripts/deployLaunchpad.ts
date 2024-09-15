import {ethers, upgrades} from 'hardhat'

async function main() {
  const fee = 20 // 2%
  const feeWallet = '';
  const factory = await ethers.getContractFactory('DKLaunchpad')
  const contract = await upgrades.deployProxy(factory, [
    fee,
    feeWallet,
    true
  ])

  await contract.waitForDeployment();

  const proxyAddress = await contract.getAddress();
  const implementAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress)

  console.log("proxyAddress ", proxyAddress);
  console.log("implementAddress ", implementAddress);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
})