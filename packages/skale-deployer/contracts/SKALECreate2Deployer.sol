// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IConfigController {
    function isAddressWhitelisted(address addr) external view returns (bool);
}

contract SKALECreate2Deployer {
    event Deployed(address contractAddress, bytes32 salt);
    bytes32 constant private _topic = keccak256("Deployed(address,bytes32)");


    fallback(bytes calldata) external returns (bytes memory) {
        address addr;

        bytes32 topic = _topic;

        // also emit the Deployed event after the create2 call
        assembly {
            calldatacopy(0, 32, sub(calldatasize(), 32))
            addr := create2(callvalue(), 0, sub(calldatasize(), 32), calldataload(0))
            if iszero(addr) {
                revert(0, 0)
            }
            mstore(0, addr)
            mstore(32, calldataload(0))
            log2(0, 64, topic, 0x00)
            return (12,20)
        }
    }
}
