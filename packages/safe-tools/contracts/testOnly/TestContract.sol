// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TestContract {

    event EchoEvent(address indexed sender, string message);

    string public somethingToRead = "helloWorld";

    function echo(string memory message, bool revertMessage) external {
        emit EchoEvent(msg.sender, message);
        if (revertMessage) {
            revert(message);
        }
    }
}
