pragma solidity ^0.8.19;

contract Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

interface GnosisSafe {
    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Enum.Operation operation
    ) external returns (bool success);

    function addOwnerWithThreshold(address owner, uint256 threshold) external;
    function removeOwner(address prevOwner, address owner, uint256 threshold) external;

    function getThreshold() external view returns (uint256);

    function getOwners() external view returns (address[] memory);

    function isOwner(address owner) external view returns (bool);

    function enableModule(address module) external;
}
