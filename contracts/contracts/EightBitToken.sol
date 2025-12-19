// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EightBitToken (8BIT)
 * @notice The native token for 8-Bit Arcade
 * @dev ERC20 token with minting controlled by authorized contracts (GameRewards, Staking)
 */
contract EightBitToken is ERC20, Ownable {
    /**
     * ⚠️ IMPORTANT: UPDATE THESE ADDRESSES AFTER DEPLOYMENT ⚠️
     *
     * Authorized minters can mint tokens for rewards:
     * - GameRewards: Daily leaderboard rewards (150M over 5 years)
     * - Staking: Staking rewards (50M over 5 years)
     *
     * Use setAuthorizedMinter() to authorize contracts after deployment.
     */
    mapping(address => bool) public authorizedMinters;

    /// @notice Maximum supply cap (500 million tokens)
    uint256 public constant MAX_SUPPLY = 500_000_000 * 10**18;

    event MinterAuthorized(address indexed minter, bool authorized);
    event TokensMinted(address indexed to, uint256 amount);

    constructor() ERC20("8-Bit Arcade Token", "8BIT") Ownable(msg.sender) {
        // Initial mint to deployer for distribution:
        // - 200M → TokenSale (40% of max supply, raises $100k)
        // - 20M → TournamentManager prize pools (4% of max supply)
        // - 50M → TestnetFaucet (testnet only, 10% of max supply)
        // - Remaining → Deployer keeps for liquidity, marketing, team
        //   Mainnet: 80M kept (16%: 60M liquidity + 15M marketing + 5M team)
        //   Testnet: 30M kept (6%: 20M liquidity + 7M marketing + 3M team)
        _mint(msg.sender, 300_000_000 * 10**18); // 60% initial supply
    }

    /**
     * @notice Authorize or revoke minting permission for a contract
     * @dev Only owner can call. Use for GameRewards and Staking contracts
     * @param minter Address to authorize/revoke
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedMinter(address minter, bool authorized) external onlyOwner {
        require(minter != address(0), "Invalid address");
        authorizedMinters[minter] = authorized;
        emit MinterAuthorized(minter, authorized);
    }

    /**
     * @notice Mint tokens as rewards
     * @dev Only callable by authorized minters (GameRewards, Staking)
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mintReward(address to, uint256 amount) external {
        require(authorizedMinters[msg.sender], "Not authorized to mint");
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Burn tokens
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
