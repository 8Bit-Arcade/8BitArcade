// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EightBitToken (8BIT)
 * @notice The native token for 8-Bit Arcade
 * @dev ERC20 token with minting controlled by the GameRewards contract
 */
contract EightBitToken is ERC20, Ownable {
    /**
     * ⚠️ IMPORTANT: UPDATE THIS ADDRESS AFTER DEPLOYMENT ⚠️
     *
     * Set this to the GameRewards contract address after deploying GameRewards.
     * The GameRewards contract needs permission to mint tokens as player rewards.
     *
     * Use setGameRewards() function to update this after deployment.
     */
    address public gameRewardsContract;

    /// @notice Maximum supply cap (100 million tokens)
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;

    event GameRewardsUpdated(address indexed oldAddress, address indexed newAddress);
    event TokensMinted(address indexed to, uint256 amount);

    constructor() ERC20("8-Bit Arcade Token", "8BIT") Ownable(msg.sender) {
        // Initial mint to deployer for liquidity, marketing, team
        // ⚠️ UPDATE: Decide initial distribution amounts
        _mint(msg.sender, 10_000_000 * 10**18); // 10% initial supply
    }

    /**
     * @notice Set the GameRewards contract address
     * @dev Only owner can call. Must be called after deploying GameRewards contract
     * @param _gameRewards Address of the GameRewards contract
     */
    function setGameRewards(address _gameRewards) external onlyOwner {
        require(_gameRewards != address(0), "Invalid address");
        address oldAddress = gameRewardsContract;
        gameRewardsContract = _gameRewards;
        emit GameRewardsUpdated(oldAddress, _gameRewards);
    }

    /**
     * @notice Mint tokens as game rewards
     * @dev Only callable by GameRewards contract
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mintReward(address to, uint256 amount) external {
        require(msg.sender == gameRewardsContract, "Only GameRewards can mint");
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
