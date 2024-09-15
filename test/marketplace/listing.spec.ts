import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { MyNFT__factory, NFTMarketplace__factory, NFTMarketplace } from "../../typechain";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ERC721 } from "../../typechain-types";

describe("Marketplace contracts testing", () => {
  let marketplaceFactory: NFTMarketplace__factory
  let marketplace: NFTMarketplace
  let collection: ERC721;
  let CollectionFactory: MyNFT__factory;
  let collectionAddr: string;
  let owner: SignerWithAddress;
  let feeWallet: SignerWithAddress;
  let recipient: SignerWithAddress;
  let recipient2: SignerWithAddress;

  const fee = 2
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  before(async function () {
    [owner, recipient, recipient2, feeWallet] = await ethers.getSigners();
  });

  const listingNft = async () => {
    await expect(marketplace.connect(owner).listingNft(
      collection,
      1,
      ethers.parseEther('0.1'),
      false,
      0
    )).to.emit(marketplace, 'MarketItemCreated')
    .withArgs(
      1,
      collectionAddr,
      1,
      owner.address,
      ZERO_ADDRESS,
      ethers.parseEther('0.1'),
      false,
      0
    )
  }

  const createFixture = async () => {
    console.log('Create fixture')

    marketplaceFactory = await ethers.getContractFactory("NFTMarketplace");
    marketplace = (await upgrades.deployProxy(marketplaceFactory, [
      fee
    ])) as any;

    CollectionFactory = await ethers.getContractFactory("MyNFT");
    collection = (await CollectionFactory.deploy(
      "AlexZuy",
      "DK",
      owner,
      '',
    )) as any;

    await collection.mint(owner, 1)
    await collection.mint(owner, 2)
    await collection.mint(recipient, 3)
    await collection.mint(recipient, 4)

    await collection.connect(owner).approve(await marketplace.getAddress(), 1)
    await collection.connect(owner).approve(await marketplace.getAddress(), 2)
    await collection.connect(recipient).approve(await marketplace.getAddress(), 3)
    await collection.connect(recipient).approve(await marketplace.getAddress(), 4)

    return {
      marketplace,
      collection,
    }
  }
  
  beforeEach(async () => {
    const fixture = await loadFixture(createFixture);
    marketplace = fixture.marketplace
    collection = fixture.collection
    collectionAddr = await collection.getAddress()
  });

  describe('Listing NFT', () => {
    it("Listing successfully", async () => {
      await listingNft();
      const newOwner = await collection.ownerOf(1)
      expect(newOwner).to.be.equal(await marketplace.getAddress())

      const item = await marketplace.getListingNft(1)
      expect(item.itemId).to.be.equal(1)
      expect(item.tokenId).to.be.equal(1)
      expect(item.price).to.be.equal(ethers.parseEther('0.1'))
    })

    it("Buy successfully", async () => {
      await listingNft();
      await expect(marketplace.connect(recipient).buyNFT(1, {
        value: ethers.parseEther('0.1')
      })).to.emit(marketplace, 'MarketItemSold')
      .withArgs(
        1,
        collectionAddr,
        1,
        owner.address,
        recipient.address,
        ethers.parseEther('0.1')
      )

      const newOwner = await collection.ownerOf(1)
      expect(newOwner).to.be.equal(recipient.address)

      const item = await marketplace.getListingNft(1)
      expect(item.sold).to.be.equal(true)
    })
  })
});
