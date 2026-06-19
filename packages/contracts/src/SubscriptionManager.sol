// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title SubscriptionManager
/// @notice Records the subscription tier of each institution and the remaining
///         free verification count for each employer.
///
///         Institution tiers:
///           FREE — the platform sponsors ETH gas for batches of up to 999 students.
///           PAID — the institution funds its own gas at any batch size.
///
///         Employer free verifications:
///           Every newly KYC-approved employer starts with three free verifications.
///           The BUNDLER_ROLE (held by the backend's bundler wallet) decrements the
///           counter after each successful auto-verify proof submission.
contract SubscriptionManager is AccessControl {
  bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");
  bytes32 public constant BUNDLER_ROLE = keccak256("BUNDLER_ROLE");

  uint256 public constant FREE_TIER_BATCH_LIMIT = 999;
  uint8 public constant FREE_VERIFICATIONS = 3;

  enum InstitutionTier {
    FREE,
    PAID
  }

  // institution ID => tier
  mapping(bytes32 => InstitutionTier) public institutionTiers;
  // employer address => free verifications remaining
  mapping(address => uint8) public freeVerificationsRemaining;
  // employer address => whether they have been initialised
  mapping(address => bool) private _employerInitialised;

  event TierChanged(bytes32 indexed institutionId, InstitutionTier newTier);
  event EmployerInitialised(address indexed employer);
  event VerificationConsumed(address indexed employer, uint8 remaining);

  error TierAlreadySet(bytes32 institutionId, InstitutionTier tier);
  error EmployerNotInitialised(address employer);
  error NoFreeVerificationsRemaining(address employer);

  constructor(address platformAdmin) {
    _grantRole(DEFAULT_ADMIN_ROLE, platformAdmin);
    _grantRole(PLATFORM_ADMIN_ROLE, platformAdmin);
  }

  // ── Institution tier management ───────────────────────────────────────────

  function setInstitutionTier(
    bytes32 institutionId,
    InstitutionTier tier
  ) external onlyRole(PLATFORM_ADMIN_ROLE) {
    if (institutionTiers[institutionId] == tier) revert TierAlreadySet(institutionId, tier);
    institutionTiers[institutionId] = tier;
    emit TierChanged(institutionId, tier);
  }

  /// @notice Returns true if the PaymasterVault should sponsor gas for this batch.
  function shouldSponsor(bytes32 institutionId, uint256 batchSize) external view returns (bool) {
    return
      institutionTiers[institutionId] == InstitutionTier.FREE && batchSize <= FREE_TIER_BATCH_LIMIT;
  }

  // ── Employer verification counter ─────────────────────────────────────────

  /// @notice Called by the VERIDAQ Admin when a new employer passes KYC.
  function initialiseEmployer(address employer) external onlyRole(PLATFORM_ADMIN_ROLE) {
    _employerInitialised[employer] = true;
    freeVerificationsRemaining[employer] = FREE_VERIFICATIONS;
    emit EmployerInitialised(employer);
  }

  /// @notice Decrements the free verification counter after a successful verification.
  ///         Only the BUNDLER_ROLE (backend bundler wallet) can call this.
  function consumeFreeVerification(address employer) external onlyRole(BUNDLER_ROLE) {
    if (!_employerInitialised[employer]) revert EmployerNotInitialised(employer);
    uint8 remaining = freeVerificationsRemaining[employer];
    if (remaining == 0) revert NoFreeVerificationsRemaining(employer);

    unchecked {
      freeVerificationsRemaining[employer] = remaining - 1;
    }
    emit VerificationConsumed(employer, remaining - 1);
  }

  function isEmployerInitialised(address employer) external view returns (bool) {
    return _employerInitialised[employer];
  }
}
