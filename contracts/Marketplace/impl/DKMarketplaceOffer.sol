//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { DKMarketplaceStorage } from "./DKMarketplaceStorage.sol";
import { Royalties} from "./Royalties.sol";
import { BaseContract } from '../../base/BaseContract.sol';

abstract contract DKMarketplaceOffer is 
  DKMarketplaceStorage,
  Royalties,
  BaseContract,
  OwnableUpgradeable, 
  ReentrancyGuardUpgradeable
{
  event OfferPlaced(
        uint256 indexed itemId,
        address indexed buyer,
        uint256 price
    );

    event CollectionOfferPlaced(
        address indexed nftContract,
        address indexed buyer,
        uint16 offerIndex,
        uint256 price,
        uint16 quantity
    );

    event OfferMade(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        uint16 offerIndex,
        uint256 price
    );

    event OfferAccepted(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed seller,
        address buyer,
        uint256 price
    );

    event OfferCancelled(
        address indexed nftContract,
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 price
    );


    function makeOffer(address nftContract, uint256 tokenId) public payable nonReentrant {
        require(msg.value > 0, "Offer price must be greater than 0");
        require(_isContract(nftContract), "Invalid nft contract");
        require(IERC721(nftContract).ownerOf(tokenId) != address(0), "NFT does not exist");
        require(IERC721(nftContract).ownerOf(tokenId) != msg.sender, "You can't make an offer on your own NFT");

        tokenIdToOffers[nftContract][tokenId].push(Offer(msg.value, msg.sender, true));

        emit OfferMade(nftContract, tokenId, msg.sender, uint16(tokenIdToOffers[nftContract][tokenId].length - 1), msg.value);
    }

    function acceptOffer(address nftContract, uint256 tokenId, uint256 offerIndex) public nonReentrant {
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "You don't own this NFT");
        require(offerIndex < tokenIdToOffers[nftContract][tokenId].length, "Invalid offer index");
        Offer storage offer = tokenIdToOffers[nftContract][tokenId][offerIndex];
        require(offer.isValid, "Offer is no longer valid");
 

        offer.isValid = false; // Invalidate the offer after acceptance
        // Refund other offers
        for (uint256 i = 0; i < tokenIdToOffers[nftContract][tokenId].length; i++) {
            if (i != offerIndex && tokenIdToOffers[nftContract][tokenId][i].isValid) {
                Offer storage otherOffer = tokenIdToOffers[nftContract][tokenId][i];
                otherOffer.isValid = false;
                payable(otherOffer.buyer).transfer(otherOffer.price);
            }
        }


        IERC721(nftContract).safeTransferFrom(msg.sender, offer.buyer, tokenId);
        uint256 salePrice = offer.price;
        payable(msg.sender).transfer(salePrice * (10000 - marketplaceFee) / 10000);
        payable(owner()).transfer(salePrice * marketplaceFee / 10000);
        // Pay royalties if applicable
        _payRoyalties(nftContract, tokenId, salePrice);
        
        emit OfferAccepted(nftContract, tokenId, msg.sender, offer.buyer, salePrice);
    }

    function cancelOffer(address nftContract, uint256 tokenId, uint256 offerIndex) public nonReentrant {
        require(offerIndex < tokenIdToOffers[nftContract][tokenId].length, "Invalid offer index");
        Offer storage offer = tokenIdToOffers[nftContract][tokenId][offerIndex];
        require(offer.buyer == msg.sender, "You can only cancel your own offers");
        require(offer.isValid, "Offer is no longer valid");

        offer.isValid = false;
        payable(msg.sender).transfer(offer.price);

        emit OfferCancelled(nftContract, tokenId, msg.sender, offer.price);
    }


    function makeCollectionOffer(address nftContract, uint16 quantity, uint256 price, uint256 expiry) public payable nonReentrant {
        require(quantity > 0, "Invalid quantity");
        require(msg.value == quantity * price, "Invalid value");
        require(_isContract(nftContract), "Invalid nft contract");

        collectionOffers[nftContract].push(CollectionOffer(price, msg.sender, quantity, 0, true));

        emit CollectionOfferPlaced(nftContract, msg.sender, uint16(collectionOffers[nftContract].length - 1), msg.value, quantity);
    }

    function acceptCollectionOffer(address nftContract, uint256 tokenId, uint256 offerIndex) public nonReentrant {
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "You don't own this NFT");
        require(offerIndex < collectionOffers[nftContract].length, "Invalid offer index");
        CollectionOffer storage offer = collectionOffers[nftContract][offerIndex];
        require(offer.isValid && offer.quantity > offer.acceptedNum, "Invalid offer");

        offer.acceptedNum++;
        if(offer.acceptedNum == offer.quantity) {
            offer.isValid = false;
        }


        IERC721(nftContract).safeTransferFrom(msg.sender, offer.buyer, tokenId);
        payable(msg.sender).transfer(offer.price * (10000 - marketplaceFee) / 10000);
        payable(owner()).transfer(offer.price * marketplaceFee / 10000);
        // Pay royalties if applicable
        _payRoyalties(nftContract, tokenId, offer.price);

        // Refund other offers
        for (uint256 i = 0; i < collectionOffers[nftContract].length; i++) {
            CollectionOffer memory _offer = collectionOffers[nftContract][i];
            if (i != offerIndex && _offer.isValid) {
                payable(_offer.buyer).transfer(_offer.price);
            }
        }

        delete collectionOffers[nftContract];
    }

}
