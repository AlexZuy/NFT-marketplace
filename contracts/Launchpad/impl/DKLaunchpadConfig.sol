//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { DKLaunchpadStorage } from "./DKLaunchpadStorage.sol";


abstract contract DKLaunchpadConfig is 
    DKLaunchpadStorage,
    OwnableUpgradeable
{
    event SetFee(uint16 oldFee, uint16 newFee);

    event SetFeeWallet(address oldWallet, address newWallet);

    event SetMinter(address oldMinter, address newMinter);

    event EnableRegistration(bool enable);

    /// @notice Update fee percent for each mint
    /// @dev Only owner can update mint fee
    /// @param _newFee new fee percent
    function setFee(uint16 _newFee) public onlyOwner {
        uint16 oldFee = fee;
        fee = _newFee;

        emit SetFee(oldFee, _newFee);
    }

    /// @notice Update the wallet which receive mint fee
    /// @dev Only owner can update the wallet which receive mint fee
    /// @param _newWallet new fee wallet address
    function setFeeWallet(address _newWallet) public onlyOwner {
        address oldWallet = feeWallet;
        feeWallet = _newWallet;

        emit SetFeeWallet(oldWallet, _newWallet);
    }

    /// @notice Enable/Disable register new collection true/false = enable/disable
    /// @dev Enable/Disable register new collection
    /// @param _enable true/false = enable/disable
    function enableRegistration(bool _enable) public onlyOwner {
        registrationOpen = _enable;

        emit EnableRegistration(_enable);
    }
}
