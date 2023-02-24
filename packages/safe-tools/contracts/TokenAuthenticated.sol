// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// import "hardhat/console.sol";

/**
 * @title TokenAuthenticated
 * @dev allow a user to authenticate with a signed english token.
 */
contract TokenAuthenticated {
    string public STATEMENT;

    uint256 public lengthOfToken = 15;
       
    struct TokenRequest {
        address owner;
        address device;
        uint256 issuedAt;
    }

    constructor(string memory _statement) {
        STATEMENT = _statement;
    }

    function _updateStatement(string memory newStatement) internal {
        STATEMENT = newStatement;
    }

    function _updateLengthOfToken(uint256 newLength) internal {
        lengthOfToken = newLength;
    }

    function authenticate(
        TokenRequest calldata request,
        bytes calldata signature
    ) internal view returns (bool) {
        bytes32 msgHash = hashForToken(request);
        address signer = ECDSA.recover(msgHash, signature);
        require(signer == request.owner, "invalid signature");
        require(
            request.issuedAt >= block.number - lengthOfToken,
            "Request is too old"
        );
        return true;
    }

    /**
     * @dev Returns the string to sign of the provided WalletCreateRequest.
     * @param request The WalletCreateRequest struct containing the owner address, device address, and issuedAt block number.
     */
    function stringToSign(
        TokenRequest calldata request
    ) internal view returns (string memory) {
        return string(abi.encodePacked(
            STATEMENT,
            "\n\nMy address:",
            Strings.toHexString(request.owner),
            "\nDevice:",
            Strings.toHexString(request.device),
            "\nIssued at:",
            Strings.toString(request.issuedAt)
        ));
    }

    function hashForToken(
        TokenRequest calldata request
    ) internal view returns (bytes32) {
        return ECDSA.toEthSignedMessageHash(bytes(stringToSign(request)));
    }
}