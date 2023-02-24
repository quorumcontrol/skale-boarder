pragma solidity ^0.8.19;

import "./interfaces/IGnosisSafe.sol";

contract SafeSetup {
    address immutable addOwnerModule;
    address immutable removeOwnerModule;

    constructor(address _addOwnerModule, address _removeOwnerModule) {
        addOwnerModule = _addOwnerModule;
        removeOwnerModule = _removeOwnerModule;
    }

    function setup() public {
        GnosisSafe safe = GnosisSafe(address(this));
        safe.enableModule(addOwnerModule);
        safe.enableModule(removeOwnerModule);
    }
}
