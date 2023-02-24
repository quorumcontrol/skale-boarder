pragma solidity ^0.8.19;

import "./interfaces/IGnosisSafe.sol";

contract SafeSetup {
    address immutable ownerModule;

    constructor(address _ownerModule) {
        ownerModule = _ownerModule;
    }

    function setup() public {
        GnosisSafe safe = GnosisSafe(address(this));
        safe.enableModule(ownerModule);
    }
}
