//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BaseContract {
	/// @dev Verify the address is contract's address base on extcodesize
	/// @param addr address of contract
	function _isContract(address addr) public view returns (bool) {
    uint256 size;
    assembly {
        size := extcodesize(addr)
  	}
  	return size > 0;
	}
}
