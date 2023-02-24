// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./TokenAuthenticated.sol";
import "./interfaces/IGnosisSafe.sol";

contract EnglishOwnerRemover is TokenAuthenticated {

    constructor() TokenAuthenticated("I want to remove this device from my account.") {}

    function removeOwner(
        address _safe,
        address previousOwner,
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
            "removeOwner(address,address,uint256)",
            previousOwner,
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
