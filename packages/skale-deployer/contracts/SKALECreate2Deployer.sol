// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;
interface IConfigController {
  function isAddressWhitelisted(address addr) external view returns (bool);
}

contract SKALECreate2Deployer {
  event Deployed(address contractAddress, bytes32 salt);

  function deploy(bytes32 salt, bytes memory code) external {
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
