// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./TokenAuthenticated.sol";

// import "hardhat/console.sol";

/**
 * @title WalletDeployer
 * @dev A contract that allows a user to create a Gnosis Safe wallet by signing an English message.
 */
contract WalletDeployer is TokenAuthenticated {

    string public CHAIN_ID;

    address private immutable _gnosisSafeContract;
    address private immutable _gnosisSafeProxyFactory;
    address private immutable _defaultFallackhandler;

    address private immutable _setupHandler;

    bytes4 private constant SETUP_DATA = bytes4(keccak256("setup()"));

    constructor(
        address gnosisSafeContract,
        address gnosisSafeProxyFactory,
        address defaultFallbackHandler,
        address setupHandler
    ) TokenAuthenticated("I authorize this device to send transactions on my behalf") {
        CHAIN_ID = Strings.toString(block.chainid);
        _gnosisSafeContract = gnosisSafeContract;
        _gnosisSafeProxyFactory = gnosisSafeProxyFactory;
        _defaultFallackhandler = defaultFallbackHandler;
        _setupHandler = setupHandler;
    }

    /**
     * @dev Creates a Gnosis Safe wallet using the provided WalletCreateRequest and signature.
     * @param request The WalletCreateRequest struct containing the owner address, first device address, and issuedAt block number.
     * @param signature The signature signed by the owner to verify ownership.
     */
    function createSafe(
        TokenRequest calldata request,
        bytes calldata signature
    ) public {
        require(authenticate(request, signature));

        // not sure exactly why, but it's important that this array is a memory address[] so that the initializer is encoded properly
        address[] memory owners;
        if (request.device == address(0)) {
            owners = new address[](1);
            owners[0] = request.owner;
        } else {
            owners = new address[](2);
            owners[0] = request.owner;
            owners[1] = request.device;
        }

        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners, // set the owner and first device addresses
            uint256(1), // set the number of required confirmations (threshhold) to 1
            _setupHandler, // setupModules address
            abi.encodeWithSignature("setup()"), // setupModules data
            _defaultFallackhandler, // set the default fallback handler
            address(0), // set the payment token address
            address(0), // set the payment token address
            uint256(0), // set the payment amount to 0
            address(0) // set the payment fee receiver address
        );

        // call the proxy factory with the gnosis safe contract as the template and the initializer as the initializer
        (bool success, bytes memory returnData) = _gnosisSafeProxyFactory.call(
            abi.encodeWithSignature(
                "createProxyWithNonce(address,bytes,uint256)",
                _gnosisSafeContract,
                initializer,
                block.chainid
            )
        );
        require(
            success,
            string(
                abi.encodePacked("failed to create proxy: ", string(returnData))
            )
        );
    }

}
