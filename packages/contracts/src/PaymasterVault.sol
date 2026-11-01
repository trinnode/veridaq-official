// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IEntryPoint} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {IPaymaster} from "account-abstraction/contracts/interfaces/IPaymaster.sol";
import {UserOperation} from "account-abstraction/contracts/interfaces/UserOperation.sol";
import {SubscriptionManager} from "./SubscriptionManager.sol";

/// @title PaymasterVault
/// @notice ERC-4337 Paymaster that sponsors or debits gas for credential batch
///         registrations, with strict per-institution ETH balance isolation.
///
///         The contract holds two pools of ETH:
///           1. sponsoredPool   — filled by the platform to cover free-tier batches.
///           2. institutionBalances[id] — funded by individual paid-tier institutions.
///
///         The validatePaymasterUserOp function decides which pool to draw from.
///         A free-tier institution with a batch of 999 or fewer students draws
///         from the sponsored pool. Everyone else draws from their own balance.
///
///         This implements the IPaymaster interface from ERC-4337 v0.6.
///         EntryPoint address on Base Sepolia: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
///
///         Inheriting IPaymaster is what keeps the EntryPoint call signature
///         honest. An earlier version declared a locally-invented
///         `validatePaymasterUserOp(bytes,uint256)` overload, which compiled
///         cleanly but answered a selector the EntryPoint never sends — so no
///         operation was ever sponsored. The interface inheritance makes that
///         class of mistake a compile error instead of a silent fallback to
///         the platform paying gas.
contract PaymasterVault is AccessControl, ReentrancyGuard, IPaymaster {
  bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");

  // ERC-4337 v0.6 EntryPoint — do not change this.
  IEntryPoint public immutable entryPoint;
  SubscriptionManager public immutable subManager;

  // Platform-sponsored pool for free-tier institutions
  uint256 public sponsoredPool;
  // Per-institution ETH balance (in wei)
  mapping(bytes32 => uint256) public institutionBalances;

  event SponsoredPoolFunded(address indexed funder, uint256 amount);
  event InstitutionFunded(bytes32 indexed institutionId, address funder, uint256 amount);
  event InstitutionWithdrew(bytes32 indexed institutionId, address to, uint256 amount);
  event GasSponsored(bytes32 indexed institutionId, uint256 gasUsed);
  event GasDebited(bytes32 indexed institutionId, uint256 gasUsed);

  error InsufficientSponsoredPool(uint256 required, uint256 available);
  error InsufficientInstitutionBalance(bytes32 id, uint256 required, uint256 available);
  error OnlyEntryPoint();
  error ZeroAmount();
  error InvalidPaymasterData(uint256 length);

  modifier onlyEntryPoint() {
    if (address(msg.sender) != address(entryPoint)) revert OnlyEntryPoint();
    _;
  }

  constructor(address _entryPoint, address _subManager, address platformAdmin) {
    entryPoint = IEntryPoint(_entryPoint);
    subManager = SubscriptionManager(_subManager);
    _grantRole(DEFAULT_ADMIN_ROLE, platformAdmin);
    _grantRole(PLATFORM_ADMIN_ROLE, platformAdmin);
  }

  // ── Funding ───────────────────────────────────────────────────────────────

  /// @notice Platform funds the sponsored pool.
  function fundSponsoredPool() external payable onlyRole(PLATFORM_ADMIN_ROLE) {
    if (msg.value == 0) revert ZeroAmount();
    sponsoredPool += msg.value;
    entryPoint.depositTo{value: msg.value}(address(this));
    emit SponsoredPoolFunded(msg.sender, msg.value);
  }

  /// @notice An institution deposits ETH to its own balance.
  function fundInstitution(bytes32 institutionId) external payable nonReentrant {
    if (msg.value == 0) revert ZeroAmount();
    institutionBalances[institutionId] += msg.value;
    entryPoint.depositTo{value: msg.value}(address(this));
    emit InstitutionFunded(institutionId, msg.sender, msg.value);
  }

  /// @notice An institution admin withdraws unused ETH from their own balance.
  ///         The caller must be the admin wallet registered for this institution
  ///         in the InstitutionRegistry. The VERIDAQ Admin can also withdraw
  ///         on behalf of an institution (e.g. for key recovery).
  ///
  ///         We accept an InstitutionRegistry reference so we can verify the
  ///         caller without storing a separate mapping here.
  function withdrawInstitutionBalance(
    bytes32 institutionId,
    address payable to,
    uint256 amount,
    address institutionRegistry
  ) external nonReentrant {
    // Allow either the institution's own admin wallet or the VERIDAQ Admin.
    bool isPlatformAdmin = hasRole(PLATFORM_ADMIN_ROLE, msg.sender);
    if (!isPlatformAdmin) {
      // Verify caller is the institution's registered admin wallet.
      (bool success, bytes memory data) = institutionRegistry.staticcall(
        abi.encodeWithSignature("getAdminWallet(bytes32)", institutionId)
      );
      require(success, "Registry call failed");
      address adminWallet = abi.decode(data, (address));
      require(msg.sender == adminWallet, "Caller is not institution admin wallet");
    }

    uint256 bal = institutionBalances[institutionId];
    if (amount > bal) {
      revert InsufficientInstitutionBalance(institutionId, amount, bal);
    }
    // Effects before interactions (CEI pattern)
    institutionBalances[institutionId] = bal - amount;
    emit InstitutionWithdrew(institutionId, to, amount);
    // Interaction
    entryPoint.withdrawTo(to, amount);
  }

  // ── ERC-4337 Paymaster interface ──────────────────────────────────────────

  /// @notice Called by the EntryPoint to validate whether this Paymaster will
  ///         pay for a UserOperation.
  ///
  ///         The paymasterAndData field encodes:
  ///         [paymaster address (20 bytes)][institutionId (32 bytes)][batchSize (32 bytes)]
  ///
  ///         Returns context (institutionId + isSponsored flag) for postOp.
  ///         Reserves maxCost up front; postOp refunds whatever the operation
  ///         did not actually consume.
  function validatePaymasterUserOp(
    UserOperation calldata userOp,
    bytes32 /* userOpHash */,
    uint256 maxCost
  )
    external
    override
    onlyEntryPoint
    returns (bytes memory context, uint256 validationData)
  {
    // 20-byte paymaster address followed by two ABI words. Anything shorter
    // cannot decode, and a silent zero-fill would attribute gas to institution 0.
    if (userOp.paymasterAndData.length < 84) {
      revert InvalidPaymasterData(userOp.paymasterAndData.length);
    }

    (bytes32 institutionId, uint256 batchSize) = abi.decode(
      userOp.paymasterAndData[20:],
      (bytes32, uint256)
    );

    bool isSponsored = subManager.shouldSponsor(institutionId, batchSize);

    if (isSponsored) {
      if (sponsoredPool < maxCost) {
        revert InsufficientSponsoredPool(maxCost, sponsoredPool);
      }
      // Reserve gas from the sponsored pool.
      sponsoredPool -= maxCost;
    } else {
      uint256 bal = institutionBalances[institutionId];
      if (bal < maxCost) {
        revert InsufficientInstitutionBalance(institutionId, maxCost, bal);
      }
      institutionBalances[institutionId] = bal - maxCost;
    }

    // Pack context for postOp: [institutionId (32)][isSponsored (1)][maxCost (32)]
    context = abi.encode(institutionId, isSponsored, maxCost);
    validationData = 0; // 0 means valid; see ERC-4337 spec for time range encoding
  }

  /// @notice Called by the EntryPoint after the UserOperation executes to reconcile
  ///         the actual gas cost with the reserved amount.
  function postOp(
    PostOpMode, /* mode */
    bytes calldata context,
    uint256 actualGasCost
  ) external override onlyEntryPoint {
    (bytes32 institutionId, bool isSponsored, uint256 maxCost) = abi.decode(
      context,
      (bytes32, bool, uint256)
    );

    uint256 refund = maxCost > actualGasCost ? maxCost - actualGasCost : 0;

    if (isSponsored) {
      sponsoredPool += refund;
      emit GasSponsored(institutionId, actualGasCost);
    } else {
      institutionBalances[institutionId] += refund;
      emit GasDebited(institutionId, actualGasCost);
    }
  }

  // ── Emergency ─────────────────────────────────────────────────────────────

  /// @notice VERIDAQ Admin withdraws the entire sponsored pool (emergency).
  ///         Used when decommissioning or migrating to a new paymaster.
  function emergencyWithdrawSponsoredPool(
    address payable to
  ) external onlyRole(PLATFORM_ADMIN_ROLE) {
    uint256 amount = sponsoredPool;
    if (amount == 0) revert ZeroAmount();
    sponsoredPool = 0;
    entryPoint.withdrawTo(to, amount);
  }

  receive() external payable {
    // Accept ETH sent directly (used by the EntryPoint for deposits)
    sponsoredPool += msg.value;
    entryPoint.depositTo{value: msg.value}(address(this));
  }
}
