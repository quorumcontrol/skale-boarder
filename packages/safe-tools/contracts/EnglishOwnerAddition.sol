pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/IGnosisSafe.sol";

contract EnglishOwnerAddition {
    string public STATEMENT =
        "I authorize this device to send transactions on my behalf";

    struct AddOwnerRequest {
        address owner;
        address device;
        uint256 issuedAt;
    }

    function addOwner(
        address _safe,
        AddOwnerRequest calldata request,
        bytes calldata signature
    ) external {
        bytes32 msgHash = hashForToken(request);
        address signer = ECDSA.recover(msgHash, signature);
        require(signer == request.owner, "invalid signature");
        require(
            request.issuedAt >= block.number - 15,
            "Only 15 blocks old requests are allowed"
        );

        GnosisSafe safe = GnosisSafe(_safe);

        {
            uint256 threshold = safe.getThreshold();
            require(
                threshold == 1,
                "Only safe's with a threshold of one are supported"
            );
            require(safe.isOwner(request.owner), "Owner is not a safe owner");
        }

        bytes memory data = abi.encodeWithSignature(
            "addOwnerWithThreshold(address,uint256)",
            request.device,
            1
        );
        GnosisSafe(_safe).execTransactionFromModule(
            _safe,
            0,
            data,
            Enum.Operation.Call
        );
    }

    function hashForToken(
        AddOwnerRequest calldata request
    ) public view returns (bytes32) {
        bytes memory stringToSign = abi.encodePacked(
            STATEMENT,
            "\n\nMy address:",
            Strings.toHexString(request.owner),
            "\nDevice:",
            Strings.toHexString(request.device),
            "\nIssued at:",
            Strings.toString(request.issuedAt)
        );
        return ECDSA.toEthSignedMessageHash(stringToSign);
    }
}
