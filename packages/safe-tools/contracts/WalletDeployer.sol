// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// import "hardhat/console.sol";

/**
 * @title WalletDeployer
 * @dev A contract that allows a user to create a Gnosis Safe wallet by signing an English message.
 */
contract WalletDeployer {
    string public STATEMENT =
        "I authorize this device to send transactions on my behalf";
    string public CHAIN_ID;

    address private immutable _gnosisSafeContract;
    address private immutable _gnosisSafeProxyFactory;
    address private immutable _defaultFallackhandler;

    address private immutable _setupHandler;

    bytes4 private constant SETUP_DATA = bytes4(keccak256("setup()"));

    struct SafeCreateRequest {
        address owner;
        address firstDevice;
        uint256 issuedAt;
    }

    constructor(
        address gnosisSafeContract,
        address gnosisSafeProxyFactory,
        address defaultFallbackHandler,
        address setupHandler
    ) {
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
        SafeCreateRequest calldata request,
        bytes calldata signature
    ) public {
        bytes32 msgHash = hashForToken(request);
        address signer = ECDSA.recover(msgHash, signature);
        require(signer == request.owner, "invalid signature");
        require(
            request.issuedAt >= block.number - 15,
            "Only 15 blocks old requests are allowed"
        );

        // not sure exactly why, but it's important that this array is a memory address[] so that the initializer is encoded properly
        address[] memory owners;
        if (request.firstDevice == address(0)) {
            owners = new address[](1);
            owners[0] = request.owner;
        } else {
            owners = new address[](2);
            owners[0] = request.owner;
            owners[1] = request.firstDevice;
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

    function hashForToken(
        SafeCreateRequest calldata request
    ) public view returns (bytes32) {
        bytes memory stringToSign = abi.encodePacked(
            STATEMENT,
            "\n\nMy address:",
            Strings.toHexString(request.owner),
            "\nDevice:",
            Strings.toHexString(request.firstDevice),
            "\nIssued at:",
            Strings.toString(request.issuedAt)
        );
        return ECDSA.toEthSignedMessageHash(stringToSign);
    }

    function iToHex(bytes memory buffer) private pure returns (string memory) {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer.length * 2);

        bytes memory _base = "0123456789abcdef";

        for (uint256 i = 0; i < buffer.length; i++) {
            converted[i * 2] = _base[uint8(buffer[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer[i]) % _base.length];
        }

        return string(abi.encodePacked("0x", converted));
    }
}
