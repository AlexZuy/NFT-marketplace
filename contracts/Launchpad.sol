//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {DKLaunchpadGetter} from "./Launchpad/impl/DKLaunchpadGetter.sol";
import { DKLaunchpadConfig } from "./Launchpad/impl/DKLaunchpadConfig.sol";
import { MyNFT } from './ERC721.sol';
import { BaseContract } from './base/BaseContract.sol';

/// @notice Launchpad contract
/// This contract provide method to register new collection and mint features on NFT Marketplace
/// @dev This launchpad contract was created to support register launchpad event for an existing collection.
contract DKLaunchpad is 
    DKLaunchpadGetter,
    DKLaunchpadConfig,
    BaseContract,
    UUPSUpgradeable
{
    event MintNft(
        address indexed collection,
        string group,
        address recipient,
        uint256 price,
        uint16 tokenId,
        uint32 quantity
    );
    event RegisterLaunchpadEvent(address indexed collection);
    event RemoveLaunchpadEvent(address indexed collection);
    event UpdateGroup(address collection);

    modifier registrationOpening() {
        require(registrationOpen, "Register new collection feature is closing");

        _;
    }

    function initialize(
        uint8 _fee,
        address _feeWallet,
        bool _registrationOpen
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        fee = _fee;
        feeWallet = _feeWallet;
        registrationOpen = _registrationOpen;
        ONE_HUNDRED_PERCENT = 1000;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    /** 
    * @notice Register launchpad event for a existed collection
    * @dev After deploy a ERC721/ERC1155 contract, register launchpad event for it on launchpad contract
    * @param _collection object Collection: Collection data
    * @param _mintGroups array Mintgroup: Include mint price, mint time, whitelist,... of list groups
    * @param _creators array Creator: List creator address and share amount.
    */
    function registerLaunchpadEvent(Collection calldata _collection, MintGroup[] memory _mintGroups, Creator[] memory _creators)
        external
        onlyOwner
        registrationOpening
    {
        require(_isContract(_collection.collectionAddress), "Invalid collection address");

        _verifyCollectionData(_collection);
        _verifyMintGroup(_mintGroups);
        _verifyMintShare(_creators);

        Collection memory collection = collections[_collection.collectionAddress];
        require(collection.collectionAddress == address(0), "Collection is existing");

        collections[_collection.collectionAddress] = _collection;
        delete mintGroups[_collection.collectionAddress];
        
        for (uint256 i = 0; i < _mintGroups.length; i++) {
            mintGroups[_collection.collectionAddress].push(_mintGroups[i]);
        }

        for (uint256 i = 0; i < _creators.length; i++) {
            creators[_collection.collectionAddress].push(_creators[i]);
        }

        emit RegisterLaunchpadEvent(_collection.collectionAddress);
    }

    function removeLaunchpadEvent(address collectionAddress) external onlyOwner() {
        
        Collection memory collection = collections[collectionAddress];
        require(collection.collectionAddress != address(0), "Collection is not found");

        delete collections[collectionAddress];
        delete mintGroups[collectionAddress];
        delete creators[collectionAddress];

        emit RemoveLaunchpadEvent(collectionAddress);
    }

    /** 
    * @notice Update an mint phase of collection
    * @dev Update an mint phase of collection
    * @param _collection object Collection
    * @param _mintGroups Array MintGroup
    */
    function updateGroup(address _collection, MintGroup[] memory _mintGroups)
        external
        onlyOwner
    {
        delete mintGroups[_collection];
        MintGroup[] storage mintGroup = mintGroups[_collection];
        
        for (uint256 i = 0; i < _mintGroups.length; i++) {
            mintGroup.push(_mintGroups[i]);
        }

        emit UpdateGroup(_collection);
    }

    /** 
    * @notice Batch Mint NFTs
    * @dev Batch mint multiple NFT of a collection with specific group
    * This function mint multiple NFT with one transaction
    * @param _collection Address of collection
    * @param _group mint group which user belong to (eg: og, whitelist, public, earlier,...)
    * @param recipient Recipient address receive NFT
    * @param quantity Amount NFTs
    * @param merkleProof If group require merkleProof to verify permission of that user with group, user should provide it
    */
    function mint(
        address _collection,
        string calldata _group,
        address recipient,
        uint8 quantity,
        bytes32[] calldata merkleProof
    ) external virtual payable {

        (Collection storage collection, MintGroup memory group) = _validateMint(
            _collection,
            _group,
            recipient,
            quantity,
            merkleProof
        );

        mintInfo[_collection][_group][recipient] += quantity;

        for(uint8 i = 0; i < quantity; i++) {
            MyNFT(_collection).mint(recipient, collection.nextTokenId + i);
            collection.nextTokenId++;
        }

        _transferFee(group, quantity);
        _transferFeeToCreator(_collection, group, quantity);

        emit MintNft(_collection, _group, recipient, group.mintPrice, collection.nextTokenId - quantity, quantity);
    }



    //*********************************************************************
    //********************* PRIVATE FUNCTION ******************************
    //*********************************************************************



    function _validateMint(
        address _collection,
        string calldata _group,
        address recipient,
        uint8 quantity,
        bytes32[] calldata merkleProof
    ) private returns(Collection storage, MintGroup memory) {
        // Validate quantity
        require(quantity > 0, "Invalid quantity");

        // Validate collection
        Collection storage collection = collections[_collection];
        require(collection.collectionAddress != address(0), "Collection not found");
        require(
            collection.nextTokenId - collection.startOrder < collection.supply &&
            collection.nextTokenId + quantity - 1 - collection.startOrder < collection.supply
            , "Sold out"
        );

        // Validate group
        MintGroup memory group;
        MintGroup[] memory mintGroups_ = mintGroups[_collection];
        for(uint8 i = 0; i < mintGroups_.length; i++) {
            if(keccak256(abi.encodePacked(mintGroups_[i].name)) == keccak256(abi.encodePacked(_group))) {
                group = mintGroups_[i];
            }
        }
        require(bytes(group.name).length > 0, "Invalid group");
        require(group.startTime <= block.timestamp, "Not start mint");
        require(group.endTime == 0 || group.endTime > block.timestamp, "Mint event ended");

        // Verify recipient inside whitelist or not
        require(
            group.merkleRoot == bytes32(0) || MerkleProof.verify(merkleProof, group.merkleRoot, keccak256(abi.encodePacked(recipient))),
            'Invalid Merkle proof'
        );

        // Check minted NFT of that recipient not greater than max token each user
        uint16 mintSize = mintInfo[_collection][_group][recipient];
        require(group.maxTokens == 0 || mintSize + quantity <= group.maxTokens, "Max tokens minted");

        _validateFund(msg.value, group, quantity);

        return (collection, group);
    }

    /// @dev function caculate fee amount and transfer it to feeWallet
    /// @param _group Group object
    /// @param quantity Quantity NFTs will mint
    function _transferFee(MintGroup memory _group, uint8 quantity) internal {
        uint256 feeAmount = _group.mintPrice * fee / ONE_HUNDRED_PERCENT;

        payable(feeWallet).transfer(quantity * feeAmount);
    }

    /// @dev function caculate mint value and transfer it to collection's creator
    /// @param _group Group object 
    /// @param quantity Quantity NFTs will mint
    function _transferFeeToCreator(address collection, MintGroup memory _group, uint8 quantity) internal {
        uint256 totalAmount = _group.mintPrice * quantity;
        for(uint8 i = 0; i < creators[collection].length; i++) {
            uint256 amount = totalAmount * creators[collection][i].share / ONE_HUNDRED_PERCENT;
            payable(creators[collection][i].wallet).transfer(amount);
        }
    }

    /// @dev Verify collection data before register launchpad event
    /// @param _collection Collection
    function _verifyCollectionData(Collection memory _collection) private view {
        require(_collection.supply > 0, "Invalid collection data");
        require(_collection.nextTokenId > 0, "Invalid collection data");
        require(_isContract(_collection.collectionAddress), "Invalid collection data");
    }

    /// @dev Verify mint group info, include price, mint time, merkleRoot of whitelist, max mint token per user
    /// @param _mintGroup Array MintGroup
    function _verifyMintGroup(MintGroup[] memory _mintGroup) private pure {
        for (
            uint8 j = 0;
            j < _mintGroup.length;
            j++
        ) {
            require(_mintGroup[j].startTime < _mintGroup[j].endTime, "Invalid mint group");
            require(_mintGroup[j].maxTokens > 0, "Invalid mint group");
        }
    }

    /// @dev Verify share info of creator is valid (sum = 100%)
    /// @param _creators Array Creators
    function _verifyMintShare(Creator[] memory _creators) private pure {
        uint16 totalShare = 0;
        for (
            uint8 j = 0;
            j < _creators.length;
            j++
        ) {
            totalShare += _creators[j].share;
        }
        require(totalShare == 100, "Invalid creator info");
    }

    /// @dev Verify value minter provide enough to mint. it should equal mintPrice + fee
    /// @param value value minter provide
    /// @param _group Group object which contain mintPrice
    /// @param quantity Quantity NFT will mint 
    function _validateFund(uint256 value, MintGroup memory _group, uint8 quantity) internal view {
        if(_group.mintPrice > 0) {
            uint256 feeAmount = _group.mintPrice * fee / ONE_HUNDRED_PERCENT;

            require(value >= quantity * (_group.mintPrice + feeAmount), "Insufficient fund");
        }
    }
}
