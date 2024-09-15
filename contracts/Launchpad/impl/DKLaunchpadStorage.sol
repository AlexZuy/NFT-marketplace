//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Storages for launchpad contract
/// @dev This is primary storage for launchpad contract
abstract contract DKLaunchpadStorage 
{
    struct Creator {
        address wallet;
        uint16 share;
    }

    struct MintGroup {
        string name;
        uint256 mintPrice;
        uint64 endTime;
        uint64 startTime;
        bytes32 merkleRoot;
        uint16 maxTokens;
    }

    struct Collection {
        string name;
        string symbol;
        string tokenUri;
        address royaltyWallet;
        uint16 supply;
        uint16 royaltyPercent;
        /// @dev token id for next mint time
        uint16 nextTokenId;
        uint16 startOrder;
        address collectionAddress;
    }

    /// @dev List collection registered
    mapping(address => Collection) public collections;

    /// @dev Save mint info of user
    // mintInfo[collection][group][wallet_address] = number NFT minted
    mapping(address => mapping(string => mapping(address => uint16))) internal mintInfo;

    /// @dev group wallet, eg: og, whitelist, public
    mapping(address => MintGroup[]) internal mintGroups;

    mapping(address => Creator[]) internal creators;

    mapping(address => address[]) internal blacklists;

     // Receiver mint fee
    address public feeWallet;
    
    uint16 internal ONE_HUNDRED_PERCENT;

    // Fee percent platform receive when user mint NFT
    uint16 public fee;

    // Status of launchpad: Allow or Disallow register new collection
    /// @dev can use this flag to close feature register collection
    bool internal registrationOpen;

    // function _isContract(address addr) internal view returns (bool) {
    //     uint256 size;
    //     assembly {
    //         size := extcodesize(addr)
    //     }
    //     return size > 0;
	// }
}
