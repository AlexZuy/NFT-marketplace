//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { DKMarketplaceStorage } from "./DKMarketplaceStorage.sol";

abstract contract DKMarketplaceGetter is 
  DKMarketplaceStorage,
  OwnableUpgradeable 
{
  function getListingNft(uint256 itemId) public view returns(MarketItem memory) {
    return idToMarketItem[itemId];
  }

  function getBidding(uint256 itemId) public view returns(Bid[] memory) {
    return itemToBids[itemId];
  }
}
