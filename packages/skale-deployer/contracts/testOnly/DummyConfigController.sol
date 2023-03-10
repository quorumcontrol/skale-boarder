// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "../SKALECreate2Deployer.sol";

contract DummyConfigController is IConfigController {
    mapping(address => bool) private _isAllowed;

    function setAllowed(address addr, bool allowed) external {
        _isAllowed[addr] = allowed;
    }

    function isAddressWhitelisted(address addr) external view returns (bool) {
        return _isAllowed[addr];
    }
}