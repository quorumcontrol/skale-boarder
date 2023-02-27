// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Echo {
   event MessageSent(address indexed from, string message);

    function echo(string calldata message) external {
        emit MessageSent(msg.sender, message);
    }
}
