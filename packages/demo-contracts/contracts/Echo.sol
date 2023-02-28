// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Echo {
     event EchoEvent(address indexed sender, string message);

    function echo(string memory message, bool revertMessage) external {
        emit EchoEvent(msg.sender, message);
        if (revertMessage) {
            revert(message);
        }
    }
    
}
