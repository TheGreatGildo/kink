// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Faucet
 * @notice A faucet contract that distributes CEFI and DEFI tokens
 * @dev Supports both mintable tokens (via mint function) and non-mintable tokens (via deposits)
 */
contract Faucet is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Amount to distribute per request (100 tokens with 18 decimals)
    uint256 public constant AMOUNT_PER_REQUEST = 100 * 10**18;

    // Token addresses
    IERC20 public immutable cefiToken;
    IERC20 public immutable defiToken;

    // Track if tokens are mintable (have a mint function)
    bool public cefiMintable;
    bool public defiMintable;

    // Mapping to track last request time per address (for rate limiting if needed)
    mapping(address => uint256) public lastRequestTime;

    // Events
    event TokensRequested(address indexed recipient, uint256 cefiAmount, uint256 defiAmount);
    event TokensDeposited(address indexed token, uint256 amount);
    event MintabilityUpdated(address indexed token, bool mintable);

    /**
     * @notice Constructor
     * @param _cefiToken Address of the CEFI token
     * @param _defiToken Address of the DEFI token
     */
    constructor(address _cefiToken, address _defiToken) Ownable(msg.sender) {
        require(_cefiToken != address(0), "Faucet: invalid CEFI token address");
        require(_defiToken != address(0), "Faucet: invalid DEFI token address");

        cefiToken = IERC20(_cefiToken);
        defiToken = IERC20(_defiToken);

        // Try to detect if tokens are mintable by checking if they have a mint function
        // We'll set this manually via setMintability if needed
        cefiMintable = false;
        defiMintable = false;
    }

    /**
     * @notice Request tokens from the faucet
     * @dev Distributes 100 CEFI and 100 DEFI tokens to the caller
     */
    function requestTokens() external nonReentrant {
        address recipient = msg.sender;

        // Distribute CEFI tokens
        if (cefiMintable) {
            // Try to mint if mintable
            (bool success, ) = address(cefiToken).call(
                abi.encodeWithSignature("mint(address,uint256)", recipient, AMOUNT_PER_REQUEST)
            );
            require(success, "Faucet: CEFI mint failed");
        } else {
            // Transfer from contract balance
            uint256 cefiBalance = cefiToken.balanceOf(address(this));
            require(cefiBalance >= AMOUNT_PER_REQUEST, "Faucet: insufficient CEFI balance");
            cefiToken.safeTransfer(recipient, AMOUNT_PER_REQUEST);
        }

        // Distribute DEFI tokens
        if (defiMintable) {
            // Try to mint if mintable
            (bool success, ) = address(defiToken).call(
                abi.encodeWithSignature("mint(address,uint256)", recipient, AMOUNT_PER_REQUEST)
            );
            require(success, "Faucet: DEFI mint failed");
        } else {
            // Transfer from contract balance
            uint256 defiBalance = defiToken.balanceOf(address(this));
            require(defiBalance >= AMOUNT_PER_REQUEST, "Faucet: insufficient DEFI balance");
            defiToken.safeTransfer(recipient, AMOUNT_PER_REQUEST);
        }

        lastRequestTime[recipient] = block.timestamp;
        emit TokensRequested(recipient, AMOUNT_PER_REQUEST, AMOUNT_PER_REQUEST);
    }

    /**
     * @notice Deposit tokens into the faucet
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     * @dev Allows owner or anyone to deposit tokens to enable the faucet
     */
    function depositTokens(address token, uint256 amount) external {
        require(token == address(cefiToken) || token == address(defiToken), "Faucet: invalid token");
        require(amount > 0, "Faucet: amount must be greater than 0");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TokensDeposited(token, amount);
    }

    /**
     * @notice Set whether tokens are mintable
     * @param _cefiMintable Whether CEFI token is mintable
     * @param _defiMintable Whether DEFI token is mintable
     * @dev Only owner can call this
     */
    function setMintability(bool _cefiMintable, bool _defiMintable) external onlyOwner {
        cefiMintable = _cefiMintable;
        defiMintable = _defiMintable;
        emit MintabilityUpdated(address(cefiToken), _cefiMintable);
        emit MintabilityUpdated(address(defiToken), _defiMintable);
    }

    /**
     * @notice Get the balance of tokens in the faucet
     * @return cefiBalance Balance of CEFI tokens
     * @return defiBalance Balance of DEFI tokens
     */
    function getBalances() external view returns (uint256 cefiBalance, uint256 defiBalance) {
        cefiBalance = cefiToken.balanceOf(address(this));
        defiBalance = defiToken.balanceOf(address(this));
    }

    /**
     * @notice Withdraw tokens from the faucet (owner only)
     * @param token Address of the token to withdraw
     * @param amount Amount of tokens to withdraw
     * @dev Only owner can call this
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}

