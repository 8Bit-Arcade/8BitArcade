// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AchievementBadges
 * @notice Soulbound (non-transferable) ERC-721 NFTs for 8-Bit Arcade achievements
 * @dev UUPS upgradeable. Implements EIP-5192 "locked" pattern.
 *      Badges are minted only when a player reaches an in-game goal, verified by the backend.
 *      They cannot be traded, sold, or transferred - they are pure bragging rights.
 */
contract AchievementBadges is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice Next token ID to mint
    uint256 public nextTokenId;

    /// @notice Authorized minters (AchievementManager contract, backend wallet)
    mapping(address => bool) public authorizedMinters;

    /// @notice Achievement type ID for each token (maps tokenId => achievementTypeId)
    mapping(uint256 => uint256) public tokenAchievementType;

    /// @notice Track which achievements a player has earned (player => achievementTypeId => tokenId)
    mapping(address => mapping(uint256 => uint256)) public playerAchievements;

    /// @notice Total badges minted per achievement type
    mapping(uint256 => uint256) public achievementMintCount;

    /// @notice Base URI for token metadata
    string public baseTokenURI;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event Locked(uint256 tokenId);
    event BadgeMinted(address indexed player, uint256 indexed tokenId, uint256 indexed achievementTypeId);
    event MinterUpdated(address indexed minter, bool authorized);

    // ═══════════════════════════════════════════════════════════
    // INITIALIZER (replaces constructor for proxy)
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(string memory _baseTokenURI) public initializer {
        __ERC721_init("8-Bit Arcade Achievement Badges", "8BIT-BADGE");
        __ERC721URIStorage_init();
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();

        baseTokenURI = _baseTokenURI;
        nextTokenId = 1;
    }

    // ═══════════════════════════════════════════════════════════
    // SOULBOUND ENFORCEMENT
    // ═══════════════════════════════════════════════════════════

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert("AchievementBadges: soulbound, cannot transfer");
        }
        return super._update(to, tokenId, auth);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    // ═══════════════════════════════════════════════════════════
    // MINTING
    // ═══════════════════════════════════════════════════════════

    function mintBadge(
        address to,
        uint256 achievementTypeId,
        string calldata uri
    ) external returns (uint256) {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(to != address(0), "Invalid recipient");
        require(playerAchievements[to][achievementTypeId] == 0, "Already earned this achievement");

        uint256 tokenId = nextTokenId++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        tokenAchievementType[tokenId] = achievementTypeId;
        playerAchievements[to][achievementTypeId] = tokenId;
        achievementMintCount[achievementTypeId]++;

        emit Locked(tokenId);
        emit BadgeMinted(to, tokenId, achievementTypeId);

        return tokenId;
    }

    function batchMintBadges(
        address to,
        uint256[] calldata achievementTypeIds,
        string[] calldata uris
    ) external {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(to != address(0), "Invalid recipient");
        require(achievementTypeIds.length == uris.length, "Arrays length mismatch");

        for (uint256 i = 0; i < achievementTypeIds.length; i++) {
            if (playerAchievements[to][achievementTypeIds[i]] != 0) {
                continue;
            }

            uint256 tokenId = nextTokenId++;

            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);

            tokenAchievementType[tokenId] = achievementTypeIds[i];
            playerAchievements[to][achievementTypeIds[i]] = tokenId;
            achievementMintCount[achievementTypeIds[i]]++;

            emit Locked(tokenId);
            emit BadgeMinted(to, tokenId, achievementTypeIds[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    function hasAchievement(address player, uint256 achievementTypeId) external view returns (bool) {
        return playerAchievements[player][achievementTypeId] != 0;
    }

    function getAchievementToken(address player, uint256 achievementTypeId) external view returns (uint256) {
        return playerAchievements[player][achievementTypeId];
    }

    function getAchievementCount(uint256 achievementTypeId) external view returns (uint256) {
        return achievementMintCount[achievementTypeId];
    }

    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, ERC721URIStorageUpgradeable) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    function setBaseTokenURI(string calldata _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    // ═══════════════════════════════════════════════════════════
    // UUPS UPGRADE AUTHORIZATION
    // ═══════════════════════════════════════════════════════════

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
