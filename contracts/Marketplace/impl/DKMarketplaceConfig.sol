//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { DKMarketplaceStorage } from "./DKMarketplaceStorage.sol";

abstract contract DKMarketplaceConfig is 
  DKMarketplaceStorage,
  OwnableUpgradeable
{
  function setMarketplaceFee(uint256 _fee) external onlyOwner {
    require(_fee <= MAX_FEE, "Fee too high");
    marketplaceFee = _fee;
  }
}
