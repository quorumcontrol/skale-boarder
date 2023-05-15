// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import "./TokenAuthenticated.sol";
import "./interfaces/IGnosisSafe.sol";

// import "hardhat/console.sol";

interface IProxyFactory {
    function createProxyWithNonce(
        address _mastercopy,
        bytes memory initializer,
        uint256 saltNonce
    ) external returns (address proxy);
}

interface IEnglishOwnerAdder {
    function addOwner(
        address safe,
        TokenAuthenticated.TokenRequest calldata request,
        bytes calldata signature
    ) external;
}

/**
 * @title WalletDeployer
 * @dev A contract that allows a user to create a Gnosis Safe wallet by signing an English message.
 *      It sets up a a safe by calling the SafeStetup.sol contract which adds the correct modules and the TokenRequest
 *      device and owner as owners to the safe.
 */
contract WalletDeployer is TokenAuthenticated {
    string public CHAIN_ID;

    address private immutable _gnosisSafeContract;
    address private immutable _gnosisSafeProxyFactory;
    address private immutable _defaultFallackhandler;

    address private immutable _setupHandler;

    bytes4 private constant SETUP_DATA = bytes4(keccak256("setup()"));

    // a mapping of owner to safe address
    mapping(address => address) public ownerToSafe;
    mapping(address => address) public safeToOwner;

    constructor(
        address gnosisSafeContract,
        address gnosisSafeProxyFactory,
        address defaultFallbackHandler,
        address setupHandler
    )
        TokenAuthenticated(
            "I authorize this device to send transactions on my behalf."
        )
    {
        CHAIN_ID = Strings.toString(block.chainid);
        _gnosisSafeContract = gnosisSafeContract;
        _gnosisSafeProxyFactory = gnosisSafeProxyFactory;
        _defaultFallackhandler = defaultFallbackHandler;
        _setupHandler = setupHandler;
    }

    // async walletAddressForUser(user:Address):Promise<Address> {
    //     const setupData = await setupDataForUser(user)

    //     const salt = utils.keccak256(utils.solidityPack(['bytes', 'uint256'], [utils.keccak256(setupData), this.chainId]))
    //     const initCode = utils.solidityKeccak256(['bytes', 'bytes'], [await this.proxyFactory.proxyCreationCode(), utils.defaultAbiCoder.encode(['address'], [MASTER_COPY_ADDR])])

    //     const addr = utils.getCreate2Address(this.proxyFactory.address, salt, initCode)
    //     return addr.toLowerCase()
    //   }

    /**
     * @dev Creates a Gnosis Safe wallet using the provided WalletCreateRequest and signature.
     * @param request The WalletCreateRequest struct containing the owner address, first device address, and issuedAt block number.
     * @param signature The signature signed by the owner to verify ownership.
     */
    function createSafe(
        TokenRequest calldata request,
        bytes calldata signature,
        address englishOwnerAdder
    ) public {
        require(
            ownerToSafe[request.owner] == address(0),
            "Safe already exists for owner"
        );
        require(authenticate(request, signature));

        // // not sure exactly why, but it's important that this array is a memory address[] so that the initializer is encoded properly
        // address[] memory owners;
        // if (request.device == address(0)) {
        //     owners = new address[](1);
        //     owners[0] = request.owner;
        // } else {
        //     owners = new address[](2);
        //     owners[0] = request.owner;
        //     owners[1] = request.device;
        // }

        address[] memory owners = new address[](1);
        owners[0] = request.owner;

        // console.log("--handler", _setupHandler, iToHex(abi.encodeWithSignature("setup()")), _defaultFallackhandler);
        // console.log("--signer", request.owner);
        bytes memory initializer = abi.encodeWithSignature(
            "setup(address[],uint256,address,bytes,address,address,uint256,address)",
            owners, // set the owner and first device addresses
            uint256(1), // set the number of required confirmations (threshhold) to 1
            _setupHandler, // setupModules address
            abi.encodeWithSignature("setup()"), // setupModules data
            _defaultFallackhandler, // set the default fallback handler
            address(0), // set the payment token address
            uint256(0), // set the payment amount to 0
            address(0) // set the payment fee receiver address
        );

        address proxyAddr = IProxyFactory(_gnosisSafeProxyFactory)
            .createProxyWithNonce(
                _gnosisSafeContract,
                initializer,
                block.chainid
            );

        if (request.device != address(0)) {
            IEnglishOwnerAdder(englishOwnerAdder).addOwner(
                proxyAddr,
                request,
                signature
            );
        }

        ownerToSafe[request.owner] = proxyAddr;
        safeToOwner[proxyAddr] = request.owner;
    }

    function iToHex(bytes memory buffer) public pure returns (string memory) {

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

// async walletAddressForUser(user:Address):Promise<Address> {
//     const setupData = await setupDataForUser(user)

//     const salt = utils.keccak256(utils.solidityPack(['bytes', 'uint256'], [utils.keccak256(setupData), this.chainId]))
//     const initCode = utils.solidityKeccak256(['bytes', 'bytes'], [await this.proxyFactory.proxyCreationCode(), utils.defaultAbiCoder.encode(['address'], [MASTER_COPY_ADDR])])

//     const addr = utils.getCreate2Address(this.proxyFactory.address, salt, initCode)
//     return addr.toLowerCase()
//   }
