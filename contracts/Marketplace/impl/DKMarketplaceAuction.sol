//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { DKMarketplaceStorage } from "./DKMarketplaceStorage.sol";
import { DKMarketplaceListing } from './DKMarketplaceListing.sol';
import { Royalties } from "./Royalties.sol";

abstract contract DKMarketplaceAuction is 
  DKMarketplaceListing
{
  event AuctionEnded(
      uint256 indexed itemId,
      address indexed winner,
      uint256 amount
  );

  event PlaceBid(
      uint256 indexed itemId,
      address bidder,
      uint256 amount
  );
  
  function createAuction(
        address nftContract,
        uint256 tokenId,
        uint256 startingPrice,
        uint256 auctionDuration
    ) public {
        listingNft(nftContract, tokenId, startingPrice, true, auctionDuration);
    }

    function placeBid(uint256 itemId) public payable nonReentrant {
        MarketItem storage marketItem = idToMarketItem[itemId];
        require(marketItem.isAuction, "Item is not on auction");
        require(block.timestamp < marketItem.auctionEndTime, "Auction has ended");
        require(msg.value > marketItem.highestBid, "Bid must be higher than current highest bid");

        itemToBids[itemId].push(Bid(msg.sender, msg.value));

        if (marketItem.highestBidder != address(0)) {
          // Refund the previous highest bidder
          payable(marketItem.highestBidder).transfer(marketItem.highestBid);
        }
          
        if (msg.value > marketItem.highestBid) {
          marketItem.highestBidder = msg.sender;
          marketItem.highestBid = msg.value;
        }

      emit PlaceBid(itemId, msg.sender, msg.value);
    }

    function endAuction(uint256 itemId) public nonReentrant {
        MarketItem storage marketItem = idToMarketItem[itemId];
        require(marketItem.isAuction, "Item is not on auction");
        require(block.timestamp >= marketItem.auctionEndTime, "Auction has not ended yet");
        require(!marketItem.sold, "Auction already finalized");

        marketItem.sold = true;
        _itemsSold++;

        if (marketItem.highestBidder != address(0)) {
            marketItem.owner = payable(marketItem.highestBidder);
            IERC721(marketItem.nftContract).safeTransferFrom(address(this), marketItem.highestBidder, marketItem.tokenId);

            uint256 amount = marketItem.highestBid;
            marketItem.seller.transfer(amount * (10000 - marketplaceFee) / 10000);
            payable(owner()).transfer(amount * marketplaceFee / 10000);

            // Pay royalties if applicable
            _payRoyalties(marketItem.nftContract, marketItem.tokenId, amount);

            // Refund all other bidders
            Bid[] memory bids = itemToBids[itemId];
            for (uint i = 0; i < bids.length - 1; i++) {
              if(bids[i].bidder != marketItem.highestBidder) {
                payable(bids[i].bidder).transfer(bids[i].amount);
              }
            }

            emit AuctionEnded(itemId, marketItem.highestBidder, amount);
        } else {
            // No bids were placed, return the NFT to the seller
            marketItem.owner = marketItem.seller;
            IERC721(marketItem.nftContract).safeTransferFrom(address(this), marketItem.seller, marketItem.tokenId);
        }
        
        delete itemToBids[itemId];
    }

}
