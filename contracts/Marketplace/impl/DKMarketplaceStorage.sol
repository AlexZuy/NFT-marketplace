//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Marketplace contract
/// This contract provide method to register new collection and mint features on NFT Marketplace
/// @dev This Marketplace contract was created to support register Marketplace event for an existing collection.
abstract contract DKMarketplaceStorage
{
    struct MarketItem {
        uint256 itemId;
        uint256 tokenId;
        uint256 price;
        uint256 auctionEndTime;
        uint256 highestBid;
        address nftContract;
        address payable seller;
        address payable owner;
        address highestBidder;
        bool isAuction;
        bool sold;
    }

    struct Bid {
        address bidder;
        uint256 amount;
    }

    struct Offer {
        uint256 price;
        address buyer;
        bool isValid;
    }

    struct CollectionOffer {
        uint256 price;
        address buyer;
        uint16 quantity;
        uint16 acceptedNum;
        bool isValid;
    }

    uint256 internal _itemIds;
    uint256 internal _itemsSold;

    uint256 public marketplaceFee; // 2.5% fee (in basis points)
    uint256 public constant MAX_FEE = 1000; // 10% max fee

    mapping(uint256 => MarketItem) internal idToMarketItem;
    mapping(uint256 => Bid[]) internal itemToBids;
    
        // Mapping from NFT contract address to token ID to offers
    mapping(address => mapping(uint256 => Offer[])) internal tokenIdToOffers;

    mapping(address => CollectionOffer[]) internal collectionOffers;

}
