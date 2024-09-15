//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { DKMarketplaceStorage } from "./DKMarketplaceStorage.sol";
import { Royalties} from "./Royalties.sol";
import { BaseContract } from '../../base/BaseContract.sol';

abstract contract DKMarketplaceListing is 
  DKMarketplaceStorage,
  Royalties,
  BaseContract,
  OwnableUpgradeable, 
  ReentrancyGuardUpgradeable
{
  
  event MarketItemCreated(
        uint256 indexed itemId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 price,
        bool isAuction,
        uint256 auctionEndTime
    );

    event MarketItemSold(
        uint256 indexed itemId,
        address indexed nftContract,
        uint256 indexed tokenId,
        address seller,
        address owner,
        uint256 price
    );

   function listingNft(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        bool isAuction,
        uint256 auctionDuration
    ) public nonReentrant {
        require(price > 0, "Price must be greater than 0");
        require(_isContract(nftContract), "Invalid nft contract");

        _itemIds++;
        uint256 itemId = _itemIds;

        idToMarketItem[itemId] = MarketItem(
            itemId,
            tokenId,
            price,
            isAuction ? block.timestamp + auctionDuration : 0,
            0,
            nftContract,
            payable(msg.sender),
            payable(address(0)),
            address(0),
            isAuction,
            false
        );

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        emit MarketItemCreated(
            itemId,
            nftContract,
            tokenId,
            msg.sender,
            address(0),
            price,
            isAuction,
            idToMarketItem[itemId].auctionEndTime
        );
    }

    function buyNFT(uint256 itemId) public payable nonReentrant {
        MarketItem storage marketItem = idToMarketItem[itemId];
        require(!marketItem.isAuction, "Item is on auction");
        require(!marketItem.sold, "Item already sold");
        require(msg.value == marketItem.price, "Please submit the asking price");

        marketItem.owner = payable(msg.sender);
        marketItem.sold = true;
        _itemsSold++;

        marketItem.seller.transfer(msg.value * (10000 - marketplaceFee) / 10000);
        payable(owner()).transfer(msg.value * marketplaceFee / 10000);

        IERC721(marketItem.nftContract).safeTransferFrom(address(this), msg.sender, marketItem.tokenId);

        // Pay royalties if applicable
        _payRoyalties(marketItem.nftContract, marketItem.tokenId, msg.value);

        emit MarketItemSold(
            itemId,
            marketItem.nftContract,
            marketItem.tokenId,
            marketItem.seller,
            msg.sender,
            msg.value
        );
    }

}
