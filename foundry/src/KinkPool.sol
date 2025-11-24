// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

import "./libraries/CurveMath.sol";

/**
 * @title KinkPool
 * @notice Two-asset stableswap pool with asymmetric amplification ("kink") behavior.
 *         Deploy through `KinkFactory` which clones this implementation and calls `initialize`.
 */
contract KinkPool is ERC20, ReentrancyGuard, Initializable {
    using SafeERC20 for IERC20;

    uint256 private constant N_COINS = 2;
    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    address public factory;
    address public token0;
    address public token1;
    uint8 public token0Decimals;
    uint8 public token1Decimals;
    uint256 public A0;
    uint256 public A1;
    uint256 public baseFee;
    uint256 public kinkingFee;
    uint256 public softPeg0;
    uint256 public softPeg1;
    uint256[N_COINS] private tokenMultipliers;

    event Exchange(
        address indexed buyer,
        address indexed receiver,
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 dy
    );

    event AddLiquidity(
        address indexed provider,
        uint256[N_COINS] amounts,
        uint256 lpAmount
    );

    event RemoveLiquidity(
        address indexed provider,
        uint256[N_COINS] amounts,
        uint256 lpAmount
    );

    constructor() ERC20("Kink Pool LP", "KINK-LP") {
        // Disable initialization of implementation contract
        _disableInitializers();
    }

    /**
     * @notice Initialize the pool
     * @param _token0 Address of token0
     * @param _token1 Address of token1
     * @param _A0 Amplification parameter when token0 > token1
     * @param _A1 Amplification parameter when token1 > token0
     * @param _baseFee Base fee in basis points (for converging trades)
     * @param _kinkingFee Kinking fee in basis points (for diverging trades)
     */
    function initialize(
        address _token0,
        address _token1,
        uint256 _A0,
        uint256 _A1,
        uint256 _baseFee,
        uint256 _kinkingFee,
        uint256 _softPeg0,
        uint256 _softPeg1
    ) external initializer {
        require(_token0 != address(0) && _token1 != address(0), "KinkPool: Zero address");
        require(_token0 < _token1, "KinkPool: Tokens not sorted");
        require(_A0 >= 2 && _A0 <= 1000, "KinkPool: Invalid A0");
        require(_A1 >= 2 && _A1 <= 1000, "KinkPool: Invalid A1");
        require(_baseFee <= FEE_DENOMINATOR, "KinkPool: Invalid baseFee");
        require(_kinkingFee <= FEE_DENOMINATOR, "KinkPool: Invalid kinkingFee");
        // _softPeg0 and _softPeg1 are typically around 1e18 (1.0).

        uint8 decimals0 = IERC20Metadata(_token0).decimals();
        uint8 decimals1 = IERC20Metadata(_token1).decimals();
        require(decimals0 <= 18 && decimals1 <= 18, "KinkPool: Decimals too large");
        require(decimals0 == decimals1, "KinkPool: Decimals mismatch");

        factory = msg.sender;
        token0 = _token0;
        token1 = _token1;
        token0Decimals = decimals0;
        token1Decimals = decimals1;
        A0 = _A0;
        A1 = _A1;
        baseFee = _baseFee;
        kinkingFee = _kinkingFee;
        softPeg0 = _softPeg0;
        softPeg1 = _softPeg1;

        tokenMultipliers[0] = 10 ** (18 - decimals0);
        tokenMultipliers[1] = 10 ** (18 - decimals1);
    }

    /**
     * @notice Get current amplification parameter based on pool state
     * @return Current A value
     */
    function _get_current_A() internal view returns (uint256) {
        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));

        if (b0 == b1) {
            // At exact peg, use higher A
            return A0 > A1 ? A0 : A1;
        }
        return b0 > b1 ? A0 : A1;
    }

    function _balances() internal view returns (uint256[N_COINS] memory reserves) {
        reserves[0] = IERC20(token0).balanceOf(address(this));
        reserves[1] = IERC20(token1).balanceOf(address(this));
    }

    /**
     * @notice Normalize balances to 18 decimals using stored multipliers
     * @param balances Raw balance array
     * @return xp Normalized balances array
     */
    function _xp(uint256[N_COINS] memory balances) internal view returns (uint256[N_COINS] memory xp) {
        xp[0] = balances[0] * tokenMultipliers[0];
        xp[1] = balances[1] * tokenMultipliers[1];
    }

    /**
     * @notice Expose current amplification parameter for external observers
     */
    function currentAmplification() external view returns (uint256) {
        return _get_current_A();
    }

    /**
     * @notice Get current normalized balances (18 decimals)
     */
    function getNormalizedReserves() external view returns (uint256[N_COINS] memory xp) {
        return _xp(_balances());
    }

    /**
     * @notice Get current StableSwap invariant D
     */
    function currentInvariant() external view returns (uint256) {
        uint256[N_COINS] memory xp = _xp(_balances());
        return CurveMath.get_D(xp, _get_current_A());
    }

    /**
     * @notice Execute a swap
     * @param i Index of input token (0 or 1)
     * @param j Index of output token (0 or 1)
     * @param dx Input amount
     * @param min_dy Minimum output amount (slippage protection)
     * @return dy Output amount
     */
    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) external nonReentrant returns (uint256 dy) {
        require(i != j && i < N_COINS && j < N_COINS, "KinkPool: Invalid indices");
        require(dx > 0, "KinkPool: Zero input");

        IERC20 inputToken = i == 0 ? IERC20(token0) : IERC20(token1);
        IERC20 outputToken = j == 0 ? IERC20(token0) : IERC20(token1);

        uint256[N_COINS] memory reservesBefore = _balances();
        uint256 inputBalanceBefore = reservesBefore[i];
        uint256 outputBalanceBefore = reservesBefore[j];

        // Transfer input tokens
        inputToken.safeTransferFrom(msg.sender, address(this), dx);

        uint256 inputBalanceAfter = IERC20(address(inputToken)).balanceOf(address(this));
        require(inputBalanceAfter > inputBalanceBefore, "KinkPool: Insufficient input");
        uint256 actualDx = inputBalanceAfter - inputBalanceBefore;

        uint256[N_COINS] memory xpBefore = _xp(reservesBefore);

        // Calculate D using current state to determine crossing point
        uint256 currentA = _get_current_A();
        uint256 D = CurveMath.get_D(xpBefore, currentA);
        uint256 thresholdXP = D / N_COINS;

        // Check if swap crosses equilibrium (1:1 point)
        bool crossesEquilibrium = false;
        uint256 dx1 = 0;
        uint256 dx2 = 0;

        if (xpBefore[i] < xpBefore[j]) {
            // Currently converging (xp[i] < xp[j])
            // Check if we cross the threshold (D/2)
            uint256 dxNormalized = actualDx * tokenMultipliers[i];
            if (xpBefore[i] + dxNormalized > thresholdXP) {
                // Check if we actually cross (avoid precision issues if very close)
                // If xpBefore[i] + dxNormalized > thresholdXP, we MIGHT cross.
                // The gap to reach D/2 is (thresholdXP - xpBefore[i]).
                uint256 gapNormalized = thresholdXP - xpBefore[i];

                // dx1 is the input required to reach equilibrium
                // Since input is added to pool, increasing x, we just fill the gap to D/2.
                // Note: this is an approximation for the split point because D is invariant.

                uint256 gapDx = gapNormalized / tokenMultipliers[i];
                if (gapDx < actualDx) {
                    crossesEquilibrium = true;
                    dx1 = gapDx;
                    dx2 = actualDx - gapDx;
                }
            }
        }

        if (crossesEquilibrium) {
            // Split swap: first part converges (baseFee), second part diverges (kinkingFee)
            // First part: swap dx1
            uint256[N_COINS] memory xp1 = xpBefore;
            uint256 dx1Normalized = dx1 * tokenMultipliers[i];
            uint256 x1 = xp1[i] + dx1Normalized;
            uint256 y1 = CurveMath.get_y(i, j, x1, xp1, currentA);
            uint256 dy1Normalized = xp1[j] - y1;

            // Apply baseFee to the converging part
            uint256 dy1Fee = (dy1Normalized * baseFee) / FEE_DENOMINATOR;
            dy1Normalized -= dy1Fee;

            uint256 dy1 = dy1Normalized / tokenMultipliers[j];

            // Update balances to reflect first swap outcome
            xp1[i] = x1;
            xp1[j] = xpBefore[j] - dy1Normalized; // Important: reduce by actual output without fee?
            // Wait, xp1[j] should represent the internal "ideal" balance before fee was taken out?
            // Actually, for calculating the next step, we should assume the pool has LESS tokens (the output was removed).
            // The fee remains in the pool.
            // So pool balance = old_y - dy_user = old_y - (dy - fee) = y + fee.
            // y1 is the theoretical new balance if no fee.
            // So we set xp1[j] = y1 + dy1Fee.

            xp1[j] = y1 + dy1Fee;

            // Second swap with target A (opposite side)
            uint256 targetA = i == 0 ? A1 : A0;
            uint256[N_COINS] memory xp2 = xp1;
            uint256 dx2Normalized = dx2 * tokenMultipliers[i];
            uint256 x2 = xp2[i] + dx2Normalized;
            uint256 y2 = CurveMath.get_y(i, j, x2, xp2, targetA);
            uint256 dy2Normalized = xp2[j] - y2;

            // Apply fee to the diverging part based on soft peg
            // Calculate effective price of this chunk: dy/dx
            // If price < softPeg, apply kinkingFee, else baseFee
            uint256 currentFee = baseFee;
            if (dx2Normalized > 0) {
                uint256 price = (dy2Normalized * 1e18) / dx2Normalized;
                uint256 peg = i == 0 ? softPeg0 : softPeg1; // i is input token index
                // If i=0 (token0 input), we are selling token0.
                // Diverging means token0 is weak.
                // We check if price (token1 per token0) < softPeg0 (token0's value).

                if (price < peg) {
                    currentFee = kinkingFee;
                }
            }

            uint256 dy2Fee = (dy2Normalized * currentFee) / FEE_DENOMINATOR;
            dy2Normalized -= dy2Fee;

            uint256 dy2 = dy2Normalized / tokenMultipliers[j];
            dy = dy1 + dy2;
        } else {
            // Standard swap
            // Check convergence based on PRE-SWAP state
            // If we didn't cross, the entire swap is either converging or diverging based on start state.
            // Exception: if we were EXACTLY at equilibrium?
            // If xp[i] == xp[j], we are diverging immediately.

            bool converging = false;
            if (xpBefore[i] < xpBefore[j]) {
                converging = true;
            }
            // If equal or greater, converging = false (diverging).

            uint256 fee = baseFee;
            if (!converging) {
                // Diverging
                // We calculate fee after calculating dyNormalized below
            }

            uint256 dxNormalized = actualDx * tokenMultipliers[i];
            uint256 x = xpBefore[i] + dxNormalized;
            uint256 y = CurveMath.get_y(i, j, x, xpBefore, currentA);
            uint256 dyNormalized = xpBefore[j] - y;

            if (!converging) {
                 if (dxNormalized > 0) {
                    uint256 price = (dyNormalized * 1e18) / dxNormalized;
                    uint256 peg = i == 0 ? softPeg0 : softPeg1;
                    if (price < peg) {
                        fee = kinkingFee;
                    }
                 }
            } else {
                fee = baseFee;
            }

            // Apply fee on the normalized output delta
            uint256 dyFee = (dyNormalized * fee) / FEE_DENOMINATOR;
            dyNormalized -= dyFee;

            dy = dyNormalized / tokenMultipliers[j];
        }

        require(dy >= min_dy, "KinkPool: Slippage");
        require(dy > 0, "KinkPool: Insufficient output");

        uint256 outputBalanceBeforeTransfer = IERC20(address(outputToken)).balanceOf(address(this));
        require(outputBalanceBeforeTransfer >= dy, "KinkPool: Insufficient liquidity");

        outputToken.safeTransfer(msg.sender, dy);

        uint256 outputBalanceAfterTransfer = IERC20(address(outputToken)).balanceOf(address(this));
        uint256 actualDy = outputBalanceBeforeTransfer - outputBalanceAfterTransfer;
        require(actualDy > 0, "KinkPool: Transfer failed");

        if (actualDy != dy) {
            require(actualDy >= min_dy, "KinkPool: Actual output below minimum");
            dy = actualDy;
        }

        emit Exchange(msg.sender, msg.sender, i, j, actualDx, dy);
    }

    /**
     * @notice Add liquidity to the pool
     * @param amounts Array of amounts to add [token0, token1]
     * @param min_lp Minimum LP tokens to mint (slippage protection)
     * @return lpAmount Amount of LP tokens minted
     */
    function add_liquidity(
        uint256[N_COINS] memory amounts,
        uint256 min_lp
    ) external nonReentrant returns (uint256 lpAmount) {
        require(amounts[0] > 0 || amounts[1] > 0, "KinkPool: Zero amounts");

        uint256[N_COINS] memory balancesBefore = _balances();
        uint256 totalSupply = totalSupply();

        // Transfer tokens
        if (amounts[0] > 0) {
            IERC20(token0).safeTransferFrom(msg.sender, address(this), amounts[0]);
        }
        if (amounts[1] > 0) {
            IERC20(token1).safeTransferFrom(msg.sender, address(this), amounts[1]);
        }

        uint256[N_COINS] memory balancesAfter = _balances();
        uint256 currentA = _get_current_A();

        uint256[N_COINS] memory xpAfter = _xp(balancesAfter);

        if (totalSupply == 0) {
            uint256 D1 = CurveMath.get_D(xpAfter, currentA);
            require(D1 > 0, "KinkPool: Invalid D");
            lpAmount = D1;
            require(lpAmount > MINIMUM_LIQUIDITY, "KinkPool: Insufficient liquidity minted");
            // Burn the minimum liquidity to lock the price
            _mint(address(0xdEaD), MINIMUM_LIQUIDITY);
            // Mint the rest to the sender
            lpAmount -= MINIMUM_LIQUIDITY;
        } else {
            uint256[N_COINS] memory xpBefore = _xp(balancesBefore);
            uint256 D0 = CurveMath.get_D(xpBefore, currentA);
            uint256 D1 = CurveMath.get_D(xpAfter, currentA);
            require(D1 > D0, "KinkPool: D must increase");

            // Calculate LP tokens to mint
            lpAmount = (totalSupply * (D1 - D0)) / D0;
        }

        require(lpAmount >= min_lp, "KinkPool: Slippage");
        _mint(msg.sender, lpAmount);

        emit AddLiquidity(msg.sender, amounts, lpAmount);
    }

    /**
     * @notice Remove liquidity from the pool
     * @param lpAmount Amount of LP tokens to burn
     * @param min_amounts Minimum amounts to receive [token0, token1]
     * @return amounts Array of amounts withdrawn [token0, token1]
     */
    function remove_liquidity(
        uint256 lpAmount,
        uint256[N_COINS] memory min_amounts
    ) external nonReentrant returns (uint256[N_COINS] memory amounts) {
        require(lpAmount > 0, "KinkPool: Zero amount");

        uint256 totalSupply = totalSupply();
        uint256[N_COINS] memory balances = _balances();

        // Calculate amounts to withdraw
        for (uint256 i = 0; i < N_COINS; i++) {
            amounts[i] = (balances[i] * lpAmount) / totalSupply;
            require(amounts[i] >= min_amounts[i], "KinkPool: Slippage");
        }

        // Burn LP tokens
        _burn(msg.sender, lpAmount);

        // Transfer tokens
        if (amounts[0] > 0) {
            IERC20(token0).safeTransfer(msg.sender, amounts[0]);
        }
        if (amounts[1] > 0) {
            IERC20(token1).safeTransfer(msg.sender, amounts[1]);
        }

        emit RemoveLiquidity(msg.sender, amounts, lpAmount);
    }

    /**
     * @notice Calculate expected LP tokens for a given deposit
     * @param amounts Array of amounts to add [token0, token1]
     * @param is_deposit True if depositing, False if withdrawing (not used currently but standard signature)
     * @return Expected LP amount
     */
    function calc_token_amount(
        uint256[N_COINS] memory amounts,
        bool is_deposit
    ) external view returns (uint256) {
        uint256[N_COINS] memory balances = _balances();
        uint256 totalSupply = totalSupply();
        uint256 currentA = _get_current_A();
        uint256[N_COINS] memory xp = _xp(balances);
        uint256 D0 = CurveMath.get_D(xp, currentA);

        uint256[N_COINS] memory new_balances = balances;
        for (uint256 i = 0; i < N_COINS; i++) {
            if (is_deposit) {
                new_balances[i] += amounts[i];
            } else {
                // Logic for withdrawal would differ, but here we focus on deposit estimation
                if (amounts[i] > new_balances[i]) return 0;
                new_balances[i] -= amounts[i];
            }
        }

        uint256[N_COINS] memory xpAfter = _xp(new_balances);
        uint256 D1 = CurveMath.get_D(xpAfter, currentA);

        if (totalSupply == 0) {
            if (D1 <= MINIMUM_LIQUIDITY) return 0;
            return D1 - MINIMUM_LIQUIDITY;
        }

        return (totalSupply * (D1 - D0)) / D0;
    }

    /**
     * @notice Get current reserves
     * @return reserve0 Reserve of token0
     * @return reserve1 Reserve of token1
     */
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1) {
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }

    /**
     * @notice Square root function (Babylonian method)
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
