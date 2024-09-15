import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { MyNFT__factory, NFTMarketplace__factory, NFTMarketplace } from "../../typechain";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ERC721 } from "../../typechain-types";

const setToBiddingTime = async (biddingTime: number) => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [Number(biddingTime)]);
  await ethers.provider.send("evm_mine");
}

describe("Marketplace contracts testing", () => {
  let marketplaceFactory: NFTMarketplace__factory
  let marketplace: NFTMarketplace
  let collection: ERC721;
  let CollectionFactory: MyNFT__factory;
  let collectionAddr: string;
  let owner: SignerWithAddress;
  let feeWallet: SignerWithAddress;
  let user: SignerWithAddress;
  let user2: SignerWithAddress;

  const fee = 2
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

  before(async function () {
    [owner, user, user2, feeWallet] = await ethers.getSigners();
  });

  const createAuction = async () => {
    const duration = 100 * 60
    await marketplace.connect(owner).createAuction(
      collection,
      1,
      ethers.parseEther('0.1'),
      duration
    )
  }

  const placeBid = async (_user: SignerWithAddress, item: any, price: string) => {
    setToBiddingTime(parseInt(BigInt(item.auctionEndTime).toString())  - 10 * 60)
      await expect(marketplace.connect(_user).placeBid(
        item.itemId,
        { value: ethers.parseEther(price) }
      )).to.emit(marketplace, 'PlaceBid')
      .withArgs(
        item.itemId,
        _user.address,
        ethers.parseEther(price)
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
    await collection.mint(user, 3)
    await collection.mint(user, 4)

    await collection.connect(owner).approve(await marketplace.getAddress(), 1)
    await collection.connect(owner).approve(await marketplace.getAddress(), 2)
    await collection.connect(user).approve(await marketplace.getAddress(), 3)
    await collection.connect(user).approve(await marketplace.getAddress(), 4)

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

    await createAuction();
  });

  describe('Auction NFT', () => {
    it("Bidding successfully", async () => {
      const item = await marketplace.getListingNft(1)
      
      await placeBid(user, item, '0.2')

      const bids = await marketplace.getBidding(1)
      expect(bids[0].bidder).to.equal(user.address)
      expect(bids[0].amount).to.equal(ethers.parseEther('0.2'))
    })

    it("End Auction successfully", async () => {
      let item = await marketplace.getListingNft(1)
      await placeBid(user2, item, '0.1')
      await placeBid(user, item, '0.2')

      item = await marketplace.getListingNft(1)
      expect(item.highestBidder).to.equal(user.address)

      setToBiddingTime(parseInt(BigInt(item.auctionEndTime).toString())  + 10 * 60)
      await expect(marketplace.connect(user2).endAuction(1)).to.emit(marketplace, 'AuctionEnded')
      .withArgs(
        1,
        user.address,
        ethers.parseEther('0.2')
      )

      const newOwner = await collection.ownerOf(1)
      expect(newOwner).to.be.equal(user.address)

      item = await marketplace.getListingNft(1)
      expect(item.sold).to.be.equal(true)
    })
  })
});
