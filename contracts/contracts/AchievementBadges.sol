// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AchievementBadges
 * @notice Soulbound (non-transferable) ERC-721 NFTs for 8-Bit Arcade achievements
 * @dev Implements EIP-5192 "locked" pattern so wallets/marketplaces recognize these as non-transferable.
 *      Badges are minted only when a player reaches an in-game goal, verified by the backend.
 *      They cannot be traded, sold, or transferred - they are pure bragging rights.
 *
 * Architecture:
 *   - Only authorized minters (AchievementManager or backend wallet) can mint
 *   - All tokens are permanently locked (soulbound) from the moment of minting
 *   - Supports on-chain metadata via ERC721URIStorage for achievement details
 *   - EIP-5192 Locked event emitted on mint so marketplaces know it's non-transferable
 */
contract AchievementBadges is ERC721, ERC721URIStorage, Ownable {

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
    /// @dev tokenId of 0 means not earned (since token IDs start at 1)
    mapping(address => mapping(uint256 => uint256)) public playerAchievements;

    /// @notice Total badges minted per achievement type
    mapping(uint256 => uint256) public achievementMintCount;

    /// @notice Base URI for token metadata
    string public baseTokenURI;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    /// @notice EIP-5192: Emitted when a token is locked (soulbound)
    event Locked(uint256 tokenId);

    /// @notice Emitted when a badge is minted to a player
    event BadgeMinted(
        address indexed player,
        uint256 indexed tokenId,
        uint256 indexed achievementTypeId
    );

    /// @notice Emitted when a minter is authorized or revoked
    event MinterUpdated(address indexed minter, bool authorized);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor(
        string memory _baseTokenURI
    ) ERC721("8-Bit Arcade Achievement Badges", "8BIT-BADGE") Ownable(msg.sender) {
        baseTokenURI = _baseTokenURI;
        nextTokenId = 1; // Start at 1 so 0 can mean "not earned"
    }

    // ═══════════════════════════════════════════════════════════
    // SOULBOUND ENFORCEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Override transfer to prevent all transfers except minting
     * @dev Reverts on any transfer where `from` is not address(0) (i.e., not a mint)
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)), block all transfers and burns
        if (from != address(0)) {
            revert("AchievementBadges: soulbound, cannot transfer");
        }

        return super._update(to, tokenId, auth);
    }

    /**
     * @notice EIP-5192: Check if a token is locked (always true for soulbound)
     * @return True, all tokens are permanently locked
     */
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /**
     * @notice EIP-165: Declare support for EIP-5192 interface
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, ERC721URIStorage) returns (bool) {
        // EIP-5192 interface ID: 0xb45a3c0e
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    // ═══════════════════════════════════════════════════════════
    // MINTING
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Mint an achievement badge to a player
     * @dev Only callable by authorized minters. Each player can only earn each achievement once.
     * @param to Player address to receive the badge
     * @param achievementTypeId The type of achievement earned
     * @param uri Token-specific metadata URI (IPFS hash or URL)
     */
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

        // EIP-5192: Emit Locked event so wallets/marketplaces know it's soulbound
        emit Locked(tokenId);
        emit BadgeMinted(to, tokenId, achievementTypeId);

        return tokenId;
    }

    /**
     * @notice Batch mint multiple achievement badges to a player
     * @dev Useful for retroactive awards or multi-tier achievements
     * @param to Player address
     * @param achievementTypeIds Array of achievement type IDs
     * @param uris Array of metadata URIs
     */
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
                continue; // Skip already earned achievements
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

    /**
     * @notice Check if a player has earned a specific achievement
     * @param player Player address
     * @param achievementTypeId Achievement type to check
     * @return True if the player has this badge
     */
    function hasAchievement(address player, uint256 achievementTypeId) external view returns (bool) {
        return playerAchievements[player][achievementTypeId] != 0;
    }

    /**
     * @notice Get the token ID for a player's specific achievement
     * @param player Player address
     * @param achievementTypeId Achievement type
     * @return Token ID (0 if not earned)
     */
    function getAchievementToken(address player, uint256 achievementTypeId) external view returns (uint256) {
        return playerAchievements[player][achievementTypeId];
    }

    /**
     * @notice Get how many times an achievement has been earned across all players
     * @param achievementTypeId Achievement type
     * @return Number of times this achievement has been minted
     */
    function getAchievementCount(uint256 achievementTypeId) external view returns (uint256) {
        return achievementMintCount[achievementTypeId];
    }

    /**
     * @notice Return the token URI
     */
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Authorize or revoke a minter
     * @param minter Address to authorize/revoke
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "Invalid minter address");
        authorizedMinters[minter] = authorized;
        emit MinterUpdated(minter, authorized);
    }

    /**
     * @notice Update the base URI for token metadata
     * @param _baseTokenURI New base URI
     */
    function setBaseTokenURI(string calldata _baseTokenURI) external onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }
}
