// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721RoyaltyUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title TradeableItems
 * @notice Standard ERC-721 NFTs for tradeable 8-Bit Arcade collectibles
 * @dev UUPS upgradeable. Fully transferable NFTs for OpenSea, Blur, etc.
 *
 * Minting Modes:
 *   1. Achievement-gated: Only players with specific achievement badges can mint certain items
 *   2. Token sale: Players pay with 8BIT tokens to mint items
 *   3. Reward drops: Backend mints to eligible players based on off-chain criteria
 *
 * Features:
 *   - ERC-2981 royalties (configurable, default 5%)
 *   - Per-item supply caps
 *   - Achievement-gated minting via AchievementBadges contract
 *   - 8BIT ERC-20 token payments (drives demand for 8BIT token)
 *   - OpenSea/marketplace compatible metadata
 *   - Future-proof: owner can add new item types at any time
 *   - UUPS upgradeable for future enhancements
 */
contract TradeableItems is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    ERC721EnumerableUpgradeable,
    ERC721RoyaltyUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{

    // ═══════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════

    struct ItemType {
        uint256 maxSupply;           // 0 = unlimited
        uint256 totalMinted;
        uint256 requiredAchievement; // Achievement badge type ID required (0 = no requirement)
        uint256 priceInTokens;       // Price in 8BIT tokens (0 = free / reward only)
        bool active;                 // Whether this item type is mintable
        string baseURI;              // Metadata URI for this item type
    }

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice Next token ID to mint
    uint256 public nextTokenId;

    /// @notice Authorized minters (AchievementManager, backend wallet)
    mapping(address => bool) public authorizedMinters;

    /// @notice Item type definitions (itemTypeId => ItemType)
    mapping(uint256 => ItemType) public itemTypes;

    /// @notice Next item type ID
    uint256 public nextItemTypeId;

    /// @notice Maps tokenId => itemTypeId
    mapping(uint256 => uint256) public tokenItemType;

    /// @notice Track per-wallet mint count per item type (wallet => itemTypeId => count)
    mapping(address => mapping(uint256 => uint256)) public walletMintCount;

    /// @notice Max mints per wallet per item type (0 = unlimited)
    mapping(uint256 => uint256) public perWalletCap;

    /// @notice AchievementBadges contract for gating
    address public achievementBadges;

    /// @notice 8BIT ERC-20 token used for payments
    IERC20 public paymentToken;

    /// @notice Treasury address for token payments from sales
    address public treasury;

    /// @notice Contract-level metadata URI (for OpenSea collection page)
    string public contractURI;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event ItemTypeCreated(
        uint256 indexed itemTypeId,
        uint256 maxSupply,
        uint256 requiredAchievement,
        uint256 priceInTokens
    );

    event ItemMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed itemTypeId
    );

    event MinterUpdated(address indexed minter, bool authorized);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);

    // ═══════════════════════════════════════════════════════════
    // INITIALIZER (replaces constructor for proxy)
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _achievementBadges,
        address _paymentToken,
        address _treasury,
        string memory _contractURI
    ) public initializer {
        __ERC721_init("8-Bit Arcade Items", "8BIT-ITEM");
        __ERC721URIStorage_init();
        __ERC721Enumerable_init();
        __ERC721Royalty_init();
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        achievementBadges = _achievementBadges;
        paymentToken = IERC20(_paymentToken);
        treasury = _treasury;
        contractURI = _contractURI;
        nextTokenId = 1;
        nextItemTypeId = 1;

        // Default 5% royalty to treasury
        _setDefaultRoyalty(_treasury, 500); // 500 basis points = 5%
    }

    // ═══════════════════════════════════════════════════════════
    // ITEM TYPE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Create a new item type (can be called anytime to add new NFTs)
     * @param maxSupply Maximum number that can be minted (0 = unlimited)
     * @param requiredAchievement Achievement badge type ID required to mint (0 = none)
     * @param priceInTokens Price in 8BIT tokens (0 = free/reward only)
     * @param _perWalletCap Max per wallet (0 = unlimited)
     * @param uri Metadata URI for this item type
     */
    function createItemType(
        uint256 maxSupply,
        uint256 requiredAchievement,
        uint256 priceInTokens,
        uint256 _perWalletCap,
        string calldata uri
    ) external onlyOwner returns (uint256) {
        uint256 itemTypeId = nextItemTypeId++;

        itemTypes[itemTypeId] = ItemType({
            maxSupply: maxSupply,
            totalMinted: 0,
            requiredAchievement: requiredAchievement,
            priceInTokens: priceInTokens,
            active: true,
            baseURI: uri
        });

        perWalletCap[itemTypeId] = _perWalletCap;

        emit ItemTypeCreated(itemTypeId, maxSupply, requiredAchievement, priceInTokens);

        return itemTypeId;
    }

    /**
     * @notice Update an existing item type (change price, supply, requirements anytime)
     */
    function updateItemType(
        uint256 itemTypeId,
        uint256 maxSupply,
        uint256 requiredAchievement,
        uint256 priceInTokens,
        uint256 _perWalletCap,
        bool active,
        string calldata uri
    ) external onlyOwner {
        require(itemTypes[itemTypeId].active || itemTypeId < nextItemTypeId, "Item type does not exist");

        itemTypes[itemTypeId].maxSupply = maxSupply;
        itemTypes[itemTypeId].requiredAchievement = requiredAchievement;
        itemTypes[itemTypeId].priceInTokens = priceInTokens;
        itemTypes[itemTypeId].active = active;
        itemTypes[itemTypeId].baseURI = uri;
        perWalletCap[itemTypeId] = _perWalletCap;
    }

    // ═══════════════════════════════════════════════════════════
    // MINTING
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Public mint - pays with 8BIT tokens
     * @dev Player must approve this contract to spend their 8BIT tokens first.
     * @param itemTypeId The type of item to mint
     */
    function mint(uint256 itemTypeId) external nonReentrant returns (uint256) {
        ItemType storage item = itemTypes[itemTypeId];
        require(item.active, "Item type not active");
        require(item.maxSupply == 0 || item.totalMinted < item.maxSupply, "Max supply reached");

        // Check per-wallet cap
        if (perWalletCap[itemTypeId] > 0) {
            require(walletMintCount[msg.sender][itemTypeId] < perWalletCap[itemTypeId], "Wallet mint cap reached");
        }

        // Check achievement requirement
        if (item.requiredAchievement > 0) {
            require(achievementBadges != address(0), "Achievement contract not set");
            (bool success, bytes memory data) = achievementBadges.staticcall(
                abi.encodeWithSignature("hasAchievement(address,uint256)", msg.sender, item.requiredAchievement)
            );
            require(success && abi.decode(data, (bool)), "Required achievement not earned");
        }

        // Collect 8BIT token payment
        if (item.priceInTokens > 0) {
            require(address(paymentToken) != address(0), "Payment token not set");
            require(
                paymentToken.transferFrom(msg.sender, treasury, item.priceInTokens),
                "Token payment failed"
            );
        }

        return _mintItem(msg.sender, itemTypeId);
    }

    /**
     * @notice Authorized minter can mint items to any address (reward drops)
     * @param to Recipient address
     * @param itemTypeId Item type to mint
     */
    function mintReward(address to, uint256 itemTypeId) external returns (uint256) {
        require(authorizedMinters[msg.sender], "Not authorized to mint");

        ItemType storage item = itemTypes[itemTypeId];
        require(item.active, "Item type not active");
        require(item.maxSupply == 0 || item.totalMinted < item.maxSupply, "Max supply reached");

        return _mintItem(to, itemTypeId);
    }

    /**
     * @notice Batch mint reward items to multiple recipients
     */
    function batchMintReward(address[] calldata recipients, uint256 itemTypeId) external {
        require(authorizedMinters[msg.sender], "Not authorized to mint");

        ItemType storage item = itemTypes[itemTypeId];
        require(item.active, "Item type not active");
        require(
            item.maxSupply == 0 || item.totalMinted + recipients.length <= item.maxSupply,
            "Would exceed max supply"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] != address(0)) {
                _mintItem(recipients[i], itemTypeId);
            }
        }
    }

    /**
     * @dev Internal mint logic
     */
    function _mintItem(address to, uint256 itemTypeId) internal returns (uint256) {
        uint256 tokenId = nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, itemTypes[itemTypeId].baseURI);

        tokenItemType[tokenId] = itemTypeId;
        itemTypes[itemTypeId].totalMinted++;
        walletMintCount[to][itemTypeId]++;

        emit ItemMinted(to, tokenId, itemTypeId);

        return tokenId;
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Get item type details
     */
    function getItemType(uint256 itemTypeId) external view returns (
        uint256 maxSupply,
        uint256 totalMinted,
        uint256 requiredAchievement,
        uint256 priceInTokens,
        bool active,
        string memory uri
    ) {
        ItemType storage item = itemTypes[itemTypeId];
        return (
            item.maxSupply,
            item.totalMinted,
            item.requiredAchievement,
            item.priceInTokens,
            item.active,
            item.baseURI
        );
    }

    /**
     * @notice Check if a player can mint a specific item type
     */
    function canMint(address player, uint256 itemTypeId) external view returns (bool) {
        ItemType storage item = itemTypes[itemTypeId];

        if (!item.active) return false;
        if (item.maxSupply > 0 && item.totalMinted >= item.maxSupply) return false;
        if (perWalletCap[itemTypeId] > 0 && walletMintCount[player][itemTypeId] >= perWalletCap[itemTypeId]) return false;

        if (item.requiredAchievement > 0 && achievementBadges != address(0)) {
            (bool success, bytes memory data) = achievementBadges.staticcall(
                abi.encodeWithSignature("hasAchievement(address,uint256)", player, item.requiredAchievement)
            );
            if (!success || !abi.decode(data, (bool))) return false;
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = _treasury;
        _setDefaultRoyalty(_treasury, 500);
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    function setAchievementBadges(address _achievementBadges) external onlyOwner {
        achievementBadges = _achievementBadges;
    }

    function setPaymentToken(address _paymentToken) external onlyOwner {
        address oldToken = address(paymentToken);
        paymentToken = IERC20(_paymentToken);
        emit PaymentTokenUpdated(oldToken, _paymentToken);
    }

    function setContractURI(string calldata _contractURI) external onlyOwner {
        contractURI = _contractURI;
    }

    /**
     * @notice Update royalty for a specific token
     */
    function setTokenRoyalty(uint256 tokenId, address receiver, uint96 feeNumerator) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    /**
     * @notice Withdraw any stuck tokens (emergency)
     */
    function withdrawTokens(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        require(IERC20(token).transfer(treasury, balance), "Token transfer failed");
    }

    /**
     * @notice Withdraw any stuck ETH (emergency)
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        (bool sent, ) = treasury.call{value: balance}("");
        require(sent, "ETH transfer failed");
    }

    // ═══════════════════════════════════════════════════════════
    // OVERRIDES (required by Solidity for multiple inheritance)
    // ═══════════════════════════════════════════════════════════

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) returns (address) {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(
        address account,
        uint128 value
    ) internal override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        super._increaseBalance(account, value);
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable, ERC721EnumerableUpgradeable, ERC721RoyaltyUpgradeable) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    // ═══════════════════════════════════════════════════════════
    // UUPS UPGRADE AUTHORIZATION
    // ═══════════════════════════════════════════════════════════

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
