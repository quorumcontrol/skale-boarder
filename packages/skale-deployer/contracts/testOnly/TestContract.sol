// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

contract TestContract {
    function hello() external pure returns (string memory) {
      return "world";
    }
}