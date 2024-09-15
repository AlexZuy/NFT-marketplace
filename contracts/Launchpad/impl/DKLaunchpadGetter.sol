//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { DKLaunchpadStorage } from "./DKLaunchpadStorage.sol";

abstract contract DKLaunchpadGetter is 
  DKLaunchpadStorage 
{

  function getCollection(address _col) public returns(Collection memory col) {
    col = collections[_col];
  }

  function getFeeWallet() public returns(address _feeWallet) {
    _feeWallet = feeWallet;
  }

  function getFee() public returns(uint16 _fee) {
    _fee = fee;
  }

  function getRegistrationOpen() public returns(bool) {
    return registrationOpen;
  }
}