import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ERC721__factory, DKLaunchpad, DKLaunchpad__factory, MyNFT__factory } from "../typechain";
import { generateMerkleProof, generateMerkleRoot } from "./utils";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { ERC721 } from "../typechain-types";

const collectionData = {
  name: "AlexZuy",
  symbol: "DK",
  decimal: 18,
  totalSupply: 3
}

const getBaseLaunchpadCollection = (owner: SignerWithAddress, collection: ERC721) => ({
  collectionData: {
    admin: owner.address,
    collectionAddress: collection.target,
    name: collectionData.name,
    symbol: collectionData.symbol,
    supply: collectionData.totalSupply,
    tokenUri: '',
    royaltyPercent: 5,
    royaltyWallet: owner.address,
    nextTokenId: 1,
    startOrder: 1,
  },
  mintGroups: [{
    name: "og",
    merkleRoot: "0x0000000000000000000000000000000000000000000000000000000000000000",
    maxTokens: 1,
    mintPrice: ethers.parseEther('0.1'),
    startTime: Math.floor(Date.now() / 1000),
    endTime: Math.floor(Date.now() / 1000) + 100000
  }],
  creators: [{
    wallet: owner.address,
    share: 100
  }]
})

const setToMintTime = async (startTime: number) => {
  await ethers.provider.send("evm_setNextBlockTimestamp", [Number(startTime + 1000)]);
  await ethers.provider.send("evm_mine");
}


describe("Launchpad contracts testing", () => {
  let launchpad: DKLaunchpad;
  let LaunchpadFactory: DKLaunchpad__factory;
  let collection: ERC721;
  let CollectionFactory: MyNFT__factory;
  let owner: SignerWithAddress;
  let feeWallet: SignerWithAddress;
  let recipient: SignerWithAddress;
  let recipient2: SignerWithAddress;

  const fee = 2
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
  const BYTES32_EMPTY = ''

  before(async function () {
    [owner, recipient, recipient2, feeWallet] = await ethers.getSigners();
  });

  const createFixture = async () => {
    console.log('Create fixture')

    LaunchpadFactory = await ethers.getContractFactory("DKLaunchpad");
    launchpad = (await upgrades.deployProxy(LaunchpadFactory, [
      fee,
      feeWallet.address,
      1
    ])) as any;

    CollectionFactory = await ethers.getContractFactory("MyNFT");
    const launchpadAddr = await launchpad.getAddress()
    collection = (await CollectionFactory.deploy(
      collectionData.name,
      collectionData.symbol,
      launchpadAddr,
      '',
    )) as any;

    return {
      launchpad,
      collection,
    }
  }
  
  beforeEach(async () => {
    const fixture = await loadFixture(createFixture);
    launchpad = fixture.launchpad
    collection = fixture.collection
  });

  describe("Register new collection", function () {
    let collectionData: any, 
    mintGroups: any, 
    creators: any

    beforeEach(async () => {
      launchpad = (await upgrades.deployProxy(LaunchpadFactory, [
        fee,
        feeWallet.address,
        true,
      ])) as any;
      const data = getBaseLaunchpadCollection(owner, collection)
      collectionData = data.collectionData
      mintGroups = data.mintGroups
      creators = data.creators
    });
    
    it("should success + emit event", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const result = await launchpad.collections(collectionData.collectionAddress);

      expect(result.name).to.equal(collectionData.name);
    });

    it("should failed: invalid collection address", async () => {
      const {collectionData, mintGroups, creators} = getBaseLaunchpadCollection(owner, collection)
      collectionData.collectionAddress = owner.address;
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.be.revertedWith("Invalid collection address")
    });

    it("should failed: onlyOwner", async () => {
      const {collectionData, mintGroups, creators} = getBaseLaunchpadCollection(owner, collection)
      await expect(launchpad.connect(recipient).registerLaunchpadEvent(collectionData, mintGroups, creators)).to.be.revertedWithCustomError(launchpad, "OwnableUnauthorizedAccount")
    });

    it("should failed: Register new collection feature is closing", async () => {
      const {collectionData, mintGroups, creators} = getBaseLaunchpadCollection(owner, collection)
      await launchpad.enableRegistration(false);
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.be.revertedWith("Register new collection feature is closing")
    });

    it("should failed: invalid creator info", async () => {
      let {collectionData, mintGroups, creators} = getBaseLaunchpadCollection(owner, collection)
      creators[0] = {
        wallet: owner.address,
        share: 99
      }
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.be.revertedWith("Invalid creator info")

      creators = [
        {
          wallet: owner.address,
          share: 20
        },
        {
          wallet: owner.address,
          share: 70
        },
      ]
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.be.revertedWith("Invalid creator info")

      creators = [
        {
          wallet: owner.address,
          share: 30
        },
        {
          wallet: owner.address,
          share: 70
        },
      ]

      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, "RegisterLaunchpadEvent")
      .withArgs(collectionData.collectionAddress)
    });

    it("should failed: Collection is existing", async () => {
      const {collectionData, mintGroups, creators} = getBaseLaunchpadCollection(owner, collection)
      await launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators);
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.be.revertedWith("Collection is existing")
    });
  });

  describe("Renounce collection", function () {
    let collectionData: any, 
    mintGroups: any, 
    creators: any

    beforeEach(async () => {
      launchpad = (await upgrades.deployProxy(LaunchpadFactory, [
        fee,
        feeWallet.address,
        true,
      ])) as any;

      const data = getBaseLaunchpadCollection(owner, collection)
      collectionData = data.collectionData
      mintGroups = data.mintGroups
      creators = data.creators
    });
    
    it("should success + emit event", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      await expect(launchpad.removeLaunchpadEvent(collectionData.collectionAddress)).to.emit(launchpad, 'RemoveLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const col = await launchpad.collections(collectionData.collectionAddress);
      expect(col.name).to.equal('');
    });

    it("should failed: OnlyOwner", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      await expect(launchpad.connect(feeWallet).removeLaunchpadEvent(collectionData.collectionAddress)).to.be.revertedWithCustomError(launchpad, "OwnableUnauthorizedAccount")
    });

    it("should failed: Collection is not found", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      await expect(launchpad.removeLaunchpadEvent(launchpad.target)).to.be.revertedWith("Collection is not found")
    });
    
  });

  describe("Mint NFT", function () {
    let collectionData: any, 
    mintGroups: any, 
    creators: any

    beforeEach(async () => {
      const data = getBaseLaunchpadCollection(owner, collection)
      collectionData = data.collectionData
      mintGroups = data.mintGroups
      creators = data.creators
    });

    it("should success + emit event", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const balCreatorBefore = await ethers.provider.getBalance(creators[0].wallet)
      const balFeeBefore = await ethers.provider.getBalance(feeWallet.address)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];

      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.connect(recipient).mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.emit(launchpad, "MintNft").withArgs(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        recipient.address, 
        mintGroups[0].mintPrice,
        collectionData.nextTokenId, 
        1
      )

      const ownerNft = await collection.ownerOf(collectionData.nextTokenId)
      expect(ownerNft).to.be.equal(recipient.address);

      const balCreatorAfter = await ethers.provider.getBalance(creators[0].wallet)
      const balFeeAfter = await ethers.provider.getBalance(feeWallet.address)

      expect(
        BigInt(balCreatorAfter) - BigInt(balCreatorBefore)
      ).equal(
        BigInt(mintGroups[0].mintPrice) * 
        BigInt(creators[0].share) / 
        BigInt(1000)
      )

      expect(
        BigInt(balFeeAfter) - BigInt(balFeeBefore)
      ).equal(
        BigInt(mintGroups[0].mintPrice) * 
        BigInt(fee) / 
        BigInt(1000)
      )
    });

    it("should success when mint NFTs", async () => {
      mintGroups[0].maxTokens = 2;
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const balCreatorBefore = await ethers.provider.getBalance(creators[0].wallet)
      const balFeeBefore = await ethers.provider.getBalance(feeWallet.address)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];
      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.connect(recipient).mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.emit(launchpad, "MintNft").withArgs(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        recipient.address, 
        mintGroups[0].mintPrice,
        collectionData.nextTokenId, 
        1
      )

      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.connect(recipient).mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.emit(launchpad, "MintNft").withArgs(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        recipient.address, 
        mintGroups[0].mintPrice,
        collectionData.nextTokenId + 1,
        1
      )

      const ownerNft = await collection.ownerOf(collectionData.nextTokenId)
      expect(ownerNft).to.be.equal(recipient.address);

      const balCreatorAfter = await ethers.provider.getBalance(creators[0].wallet)
      const balFeeAfter = await ethers.provider.getBalance(feeWallet.address)

      expect(
        BigInt(balCreatorAfter) - BigInt(balCreatorBefore)
      ).equal(
        BigInt(2) *
        BigInt(mintGroups[0].mintPrice) * 
        BigInt(creators[0].share) / 
        BigInt(1000)
      )

      expect(
        BigInt(balFeeAfter) - BigInt(balFeeBefore)
      ).equal(
        BigInt(2) *
        BigInt(mintGroups[0].mintPrice) * 
        BigInt(fee) / 
        BigInt(1000)
      )
    });

    it("should failed: Insufficient fund", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];
      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(0) }
        )
      ).to.be.revertedWith("Insufficient fund")
    });

    it("should failed: Invalid group name", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];
      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.mint(
          collectionData.collectionAddress, 
          "invalid_group_name", 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee-1)) / BigInt(100) }
        )
      ).to.be.revertedWith("Invalid group")
    });

    it("should failed: Max tokens minted and sold out", async () => {
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];
      setToMintTime(mintGroups[0].startTime)
      await launchpad.mint(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        recipient.address, 
        1,
        dataArray, 
        { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
      )

      setToMintTime(mintGroups[0].startTime + 1000)
      await expect(launchpad.mint(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        recipient.address, 
        1,
        dataArray, 
        { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
      )).to.be.revertedWith("Max tokens minted")

      setToMintTime(mintGroups[0].startTime + 2000)
      await launchpad.mint(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        owner.address, 
        1,
        dataArray, 
        { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
      )

      setToMintTime(mintGroups[0].startTime + 3000)
      await launchpad.mint(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        feeWallet.address, 
        1,
        dataArray, 
        { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
      )

      setToMintTime(mintGroups[0].startTime + 4000)
      await expect(launchpad.mint(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        recipient2.address, 
        1,
        dataArray, 
        { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
      )).to.be.revertedWith("Sold out")
    });

    it("should failed: Not start mint", async () => {
      mintGroups[0].startTime = Math.floor(Date.now() / 1000) + 100000
      mintGroups[0].endTime = Math.floor(Date.now() / 1000) + 200000
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];
      await expect(
        launchpad.mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.be.revertedWith("Not start mint")
    });

    it("should failed: Mint event ended", async () => {
      mintGroups[0].startTime = Math.floor(Date.now() / 1000) - 100000
      mintGroups[0].endTime = Math.floor(Date.now() / 1000) - 10000
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      const dataArray = [
        ethers.encodeBytes32String(BYTES32_EMPTY)
      ];
      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          dataArray, 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.be.revertedWith("Mint event ended")
    });


    it("should success with merkle proof", async () => {
      mintGroups[0].merkleRoot = generateMerkleRoot([owner.address, feeWallet.address])
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.connect(feeWallet).mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          feeWallet.address, 
          1,
          generateMerkleProof([owner.address, feeWallet.address], feeWallet.address), 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.emit(launchpad, "MintNft").withArgs(
        collectionData.collectionAddress, 
        mintGroups[0].name, 
        feeWallet.address, 
        mintGroups[0].mintPrice,
        collectionData.nextTokenId, 
        1
      )
    });


    it("should failed with merkle proof", async () => {
      mintGroups[0].merkleRoot = generateMerkleRoot([owner.address, feeWallet.address])
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.connect(feeWallet).mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          recipient.address, 
          1,
          generateMerkleProof([owner.address, feeWallet.address], feeWallet.address), 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.be.revertedWith("Invalid Merkle proof")
    });

    it("should failed with merkle proof", async () => {
      mintGroups[0].merkleRoot = generateMerkleRoot([owner.address, feeWallet.address])
      await expect(launchpad.registerLaunchpadEvent(collectionData, mintGroups, creators)).to.emit(launchpad, 'RegisterLaunchpadEvent')
      .withArgs(collectionData.collectionAddress)

      setToMintTime(mintGroups[0].startTime)
      await expect(
        launchpad.connect(feeWallet).mint(
          collectionData.collectionAddress, 
          mintGroups[0].name, 
          feeWallet.address, 
          1,
          generateMerkleProof([feeWallet.address], feeWallet.address), 
          { value: BigInt(mintGroups[0].mintPrice) * BigInt((100+fee)) / BigInt(100) }
        )
      ).to.be.revertedWith("Invalid Merkle proof")
    });
  });

  describe("Set Fee", function () {
    it("Should success", async () => {
      await expect(launchpad.setFee(10)).to.be.emit(launchpad, 'SetFee').withArgs(2, 10);
      expect(await launchpad.fee()).to.be.equal(10);
    })

    it("OnlyOwner", async () => {
      await expect(launchpad.connect(recipient).setFee(10)).to.be.revertedWithCustomError(launchpad, "OwnableUnauthorizedAccount")
    })
  })

  describe("Set Fee Wallet", function () {
    it("Should success", async () => {
      await expect(launchpad.setFeeWallet(recipient.address)).to.be.emit(launchpad, 'SetFeeWallet').withArgs(feeWallet.address, recipient.address);
      expect(await launchpad.feeWallet()).to.be.equal(recipient.address);
    })

    it("OnlyOwner", async () => {
      await expect(launchpad.connect(recipient).setFeeWallet(recipient.address)).to.be.revertedWithCustomError(launchpad, "OwnableUnauthorizedAccount")
    })
  })

});
