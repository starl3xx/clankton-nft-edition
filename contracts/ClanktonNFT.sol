// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title ClanktonNFT
 * @notice Limited edition NFT mint paid in CLANKTON tokens with server-verified pricing
 * @dev Uses EIP-712 signatures to verify discount pricing from backend
 */
contract ClanktonNFT is ERC721, EIP712, Ownable {
    using ECDSA for bytes32;

    // ========== CONSTANTS ==========

    uint256 public constant MAX_SUPPLY = 50;
    uint256 public constant BASE_PRICE = 20_000_000 * 10**18; // 20M CLANKTON (18 decimals)

    IERC20 public immutable clanktonToken;
    address public signer; // Backend signer address

    // ========== STATE ==========

    uint256 public totalMinted;
    uint256 public mintStartTime;
    uint256 public mintEndTime;

    string private _baseTokenURI;

    // Track used signatures to prevent replay attacks
    mapping(bytes32 => bool) public usedSignatures;

    // Optional: Track mints per address (set to 0 for unlimited)
    mapping(address => uint256) public mintedPerAddress;
    uint256 public maxMintsPerAddress = 0; // 0 = unlimited

    // ========== EVENTS ==========

    event Minted(address indexed minter, uint256 indexed tokenId, uint256 price);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event MintWindowUpdated(uint256 startTime, uint256 endTime);
    event BaseURIUpdated(string newURI);
    event TokensWithdrawn(address indexed token, address indexed to, uint256 amount);

    // ========== ERRORS ==========

    error MintNotStarted();
    error MintEnded();
    error SoldOut();
    error InvalidSignature();
    error SignatureAlreadyUsed();
    error InvalidPrice();
    error MaxMintsReached();
    error TransferFailed();

    // ========== EIP-712 TYPES ==========

    bytes32 private constant MINT_TYPEHASH = keccak256(
        "MintRequest(address minter,uint256 price,uint256 nonce,uint256 deadline)"
    );

    // ========== CONSTRUCTOR ==========

    constructor(
        address _clanktonToken,
        address _signer,
        uint256 _mintStartTime,
        uint256 _mintEndTime,
        string memory _initialBaseURI
    )
        ERC721("thepapercrane x CLANKTON", "TPCCLANK")
        EIP712("ClanktonNFT", "1")
        Ownable(msg.sender)
    {
        clanktonToken = IERC20(_clanktonToken);
        signer = _signer;
        mintStartTime = _mintStartTime;
        mintEndTime = _mintEndTime;
        _baseTokenURI = _initialBaseURI;
    }

    // ========== MINTING ==========

    /**
     * @notice Mint an NFT with CLANKTON tokens
     * @param price The discounted price (verified by signature)
     * @param nonce Unique value to prevent replay attacks
     * @param deadline Signature expiration timestamp
     * @param signature EIP-712 signature from backend verifying the price
     */
    function mint(
        uint256 price,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        // Check mint window
        if (block.timestamp < mintStartTime) revert MintNotStarted();
        if (block.timestamp > mintEndTime) revert MintEnded();

        // Check supply
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();

        // Check per-address limit (if set)
        if (maxMintsPerAddress > 0) {
            if (mintedPerAddress[msg.sender] >= maxMintsPerAddress) {
                revert MaxMintsReached();
            }
        }

        // Verify signature hasn't been used
        bytes32 signatureHash = keccak256(signature);
        if (usedSignatures[signatureHash]) revert SignatureAlreadyUsed();

        // Verify deadline
        if (block.timestamp > deadline) revert InvalidSignature();

        // Verify price is valid (not more than base price)
        if (price > BASE_PRICE) revert InvalidPrice();

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(MINT_TYPEHASH, msg.sender, price, nonce, deadline)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = digest.recover(signature);

        if (recoveredSigner != signer) revert InvalidSignature();

        // Mark signature as used
        usedSignatures[signatureHash] = true;

        // Transfer CLANKTON tokens from minter to this contract
        bool success = clanktonToken.transferFrom(msg.sender, address(this), price);
        if (!success) revert TransferFailed();

        // Mint NFT
        uint256 tokenId = totalMinted + 1;
        totalMinted++;
        mintedPerAddress[msg.sender]++;

        _safeMint(msg.sender, tokenId);

        emit Minted(msg.sender, tokenId, price);
    }

    // ========== VIEW FUNCTIONS ==========

    function _baseURI() internal view virtual override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireOwned(tokenId);

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0
            ? string(abi.encodePacked(baseURI, _toString(tokenId)))
            : "";
    }

    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - totalMinted;
    }

    function isMintActive() external view returns (bool) {
        return block.timestamp >= mintStartTime &&
               block.timestamp <= mintEndTime &&
               totalMinted < MAX_SUPPLY;
    }

    // ========== ADMIN FUNCTIONS ==========

    function setSigner(address _newSigner) external onlyOwner {
        address oldSigner = signer;
        signer = _newSigner;
        emit SignerUpdated(oldSigner, _newSigner);
    }

    function setMintWindow(uint256 _startTime, uint256 _endTime) external onlyOwner {
        mintStartTime = _startTime;
        mintEndTime = _endTime;
        emit MintWindowUpdated(_startTime, _endTime);
    }

    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        _baseTokenURI = _newBaseURI;
        emit BaseURIUpdated(_newBaseURI);
    }

    function setMaxMintsPerAddress(uint256 _max) external onlyOwner {
        maxMintsPerAddress = _max;
    }

    /**
     * @notice Withdraw collected CLANKTON tokens
     */
    function withdrawTokens(address _token, address _to, uint256 _amount) external onlyOwner {
        bool success = IERC20(_token).transfer(_to, _amount);
        if (!success) revert TransferFailed();
        emit TokensWithdrawn(_token, _to, _amount);
    }

    /**
     * @notice Withdraw all CLANKTON tokens
     */
    function withdrawAllClankton(address _to) external onlyOwner {
        uint256 balance = clanktonToken.balanceOf(address(this));
        bool success = clanktonToken.transfer(_to, balance);
        if (!success) revert TransferFailed();
        emit TokensWithdrawn(address(clanktonToken), _to, balance);
    }

    // ========== INTERNAL HELPERS ==========

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
