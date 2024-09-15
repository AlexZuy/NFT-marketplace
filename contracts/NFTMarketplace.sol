// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { DKMarketplaceGetter } from "./Marketplace/impl/DKMarketplaceGetter.sol";
import { DKMarketplaceConfig } from "./Marketplace/impl/DKMarketplaceConfig.sol";
import { DKMarketplaceAuction } from "./Marketplace/impl/DKMarketplaceAuction.sol";
import { DKMarketplaceListing } from "./Marketplace/impl/DKMarketplaceListing.sol";
import { DKMarketplaceOffer } from "./Marketplace/impl/DKMarketplaceOffer.sol";

contract NFTMarketplace is 
  DKMarketplaceAuction,
  DKMarketplaceOffer,
  DKMarketplaceGetter,
  DKMarketplaceConfig,
  IERC721Receiver,
  UUPSUpgradeable 
{
    function initialize(
        uint8 _fee
    ) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        marketplaceFee = _fee;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

}