// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title InstitutionRegistry
/// @notice Stores the on-chain identity records for every academic institution
///         registered on the VERIDAQ platform.
///
///         Each institution is identified by a bytes32 slug derived off-chain
///         from the institution's name. The contract stores the admin wallet
///         address (used to authorise batch registrations and revocations) and
///         the institution's public signing key (used off-chain to verify batch
///         upload signatures before the backend submits to the chain).
///
///         Only the PLATFORM_ADMIN_ROLE can register or deactivate institutions.
///         Only the institution's own admin wallet can rotate its signing key.
contract InstitutionRegistry is AccessControl, Pausable {
  bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");

  struct Institution {
    bytes32 id;
    string name;
    address adminWallet;
    bytes publicKey;
    bool active;
    uint256 registeredAt;
  }

  mapping(bytes32 => Institution) private _institutions;
  bytes32[] private _institutionIds;

  event InstitutionRegistered(bytes32 indexed id, string name, address adminWallet);
  event InstitutionDeactivated(bytes32 indexed id);
  event InstitutionReactivated(bytes32 indexed id);
  event PublicKeyRotated(bytes32 indexed id);
  event AdminWalletTransferred(bytes32 indexed id, address newWallet);

  error AlreadyRegistered(bytes32 id);
  error NotFound(bytes32 id);
  error ZeroAddress();
  error CallerNotAdmin(bytes32 id, address caller);

  constructor(address platformAdmin) {
    _grantRole(DEFAULT_ADMIN_ROLE, platformAdmin);
    _grantRole(PLATFORM_ADMIN_ROLE, platformAdmin);
  }

  // ── External state-changing functions ────────────────────────────────────

  /// @notice Registers a new institution. The slug must be globally unique.
  function registerInstitution(
    bytes32 id,
    string calldata name,
    address adminWallet,
    bytes calldata publicKey
  ) external onlyRole(PLATFORM_ADMIN_ROLE) whenNotPaused {
    if (_institutions[id].registeredAt != 0) revert AlreadyRegistered(id);
    if (adminWallet == address(0)) revert ZeroAddress();

    _institutions[id] = Institution({
      id: id,
      name: name,
      adminWallet: adminWallet,
      publicKey: publicKey,
      active: true,
      registeredAt: block.timestamp
    });
    _institutionIds.push(id);

    emit InstitutionRegistered(id, name, adminWallet);
  }

  /// @notice Deactivates an institution, preventing new credential registrations.
  function deactivateInstitution(bytes32 id) external onlyRole(PLATFORM_ADMIN_ROLE) {
    if (_institutions[id].registeredAt == 0) revert NotFound(id);
    _institutions[id].active = false;
    emit InstitutionDeactivated(id);
  }

  /// @notice Reactivates a previously deactivated institution.
  function reactivateInstitution(bytes32 id) external onlyRole(PLATFORM_ADMIN_ROLE) {
    if (_institutions[id].registeredAt == 0) revert NotFound(id);
    _institutions[id].active = true;
    emit InstitutionReactivated(id);
  }

  /// @notice Rotates the institution's public signing key.
  ///         The signature from the current key is verified off-chain by the
  ///         backend before this transaction is submitted, so we trust the
  ///         admin wallet as the second factor of authorisation here.
  function rotatePublicKey(bytes32 id, bytes calldata newKey) external whenNotPaused {
    Institution storage inst = _institutions[id];
    if (inst.registeredAt == 0) revert NotFound(id);
    if (msg.sender != inst.adminWallet) revert CallerNotAdmin(id, msg.sender);

    inst.publicKey = newKey;
    emit PublicKeyRotated(id);
  }

  /// @notice VERIDAQ Admin can reassign the admin wallet for key recovery.
  function transferAdminWallet(
    bytes32 id,
    address newWallet
  ) external onlyRole(PLATFORM_ADMIN_ROLE) {
    if (_institutions[id].registeredAt == 0) revert NotFound(id);
    if (newWallet == address(0)) revert ZeroAddress();
    _institutions[id].adminWallet = newWallet;
    emit AdminWalletTransferred(id, newWallet);
  }

  // ── External view functions ───────────────────────────────────────────────

  function isActive(bytes32 id) external view returns (bool) {
    return _institutions[id].active;
  }

  function getAdminWallet(bytes32 id) external view returns (address) {
    return _institutions[id].adminWallet;
  }

  function getPublicKey(bytes32 id) external view returns (bytes memory) {
    return _institutions[id].publicKey;
  }

  function getInstitution(bytes32 id) external view returns (Institution memory) {
    return _institutions[id];
  }

  function getAllIds() external view returns (bytes32[] memory) {
    return _institutionIds;
  }

  // ── Admin ─────────────────────────────────────────────────────────────────

  function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _pause();
  }
  function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
    _unpause();
  }
}
