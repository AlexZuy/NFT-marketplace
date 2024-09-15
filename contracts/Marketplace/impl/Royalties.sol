// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/interfaces/IERC2981.sol";

abstract contract Royalties {
    function _payRoyalties(address nftContract, uint256 tokenId, uint256 salePrice) virtual internal {
        try IERC2981(nftContract).royaltyInfo(tokenId, salePrice) returns (address receiver, uint256 royaltyAmount) {
            if (receiver != address(0) && royaltyAmount > 0) {
                payable(receiver).transfer(royaltyAmount);
            }
        } catch {
            // No royalties to pay
        }
    }
}