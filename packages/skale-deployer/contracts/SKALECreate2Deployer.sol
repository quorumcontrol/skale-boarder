// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;
interface IConfigController {
  function isAddressWhitelisted(address addr) external view returns (bool);
}

/**
Since on SKALE chains, deployment must be allowed per address (or opened completely), but
smart contracts are always allowed to deploy, we need this deployer to also check to see if a deployer
is allowed to deploy (as opposed to other chains where deployment is completely open).
Most code is taken from https://ftmscan.com/address/0x54f5a04417e29ff5d7141a6d33cb286f50d5d50e#code
The contract has one public function `deploy`.
This function first checks if the msg.sender is whitelisted by calling the isAddressWhitelisted function.
If the msg.sender is not whitelisted, it reverts the transaction with the 
error UnauthorizedMustBeAllowedToDeploy.
If the msg.sender is whitelisted, it deploys the contract using the create2 opcode and the
input code and salt. The function then emits the event Deployed with the address and salt
of the deployed contract. 
*/
contract SKALECreate2Deployer {
  // Error that is thrown when msg.sender is not whitelisted
  error UnauthorizedMustBeAllowedToDeploy();
  error AlreadyInitialized();

  event Deployed(address contractAddress, bytes32 salt);
  IConfigController private configController;
  bool private initialized;

  function initialize(address configControllerAddr) external {
    if (initialized) {
      revert AlreadyInitialized();
    }
    initialized = true;
    configController = IConfigController(configControllerAddr);
  }

  function deploy(bytes32 salt, bytes memory code) external {
    if (!configController.isAddressWhitelisted(msg.sender)) {
      revert UnauthorizedMustBeAllowedToDeploy();
    }
    address addr;
    assembly {
      
      addr := create2(0, add(code, 0x20), mload(code), salt)
      if iszero(extcodesize(addr)) {
        revert(0, 0)
      }
    }

    emit Deployed(addr, salt);
  }
}

	// calldatacopy(0, 32, sub(calldatasize(), 32))
	// 		let result := create2(callvalue(), 0, sub(calldatasize(), 32), calldataload(0))
	// 		if iszero(result) { revert(0, 0) }
	// 		mstore(0, result)
	// 		return(12, 20)