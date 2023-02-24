// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TokenAuthenticated.sol";
import "./interfaces/IGnosisSafe.sol";

contract EnglishOwnerAddition is TokenAuthenticated {

    constructor() TokenAuthenticated("I authorize this device to send transactions on my behalf") {}

    function addOwner(
        address _safe,
        TokenRequest calldata request,
        bytes calldata signature
    ) external {
        require(authenticate(request, signature));

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

}
