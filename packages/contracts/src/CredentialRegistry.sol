// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {InstitutionRegistry} from "./InstitutionRegistry.sol";

/// @title CredentialRegistry
/// @notice Stores (commitment, nullifier) pairs for student credentials.
///
///         A commitment is Poseidon(name, matric, cgpa, class, course, year, beta)
///         where beta is a random blinding factor. No personal data can be extracted
///         from a commitment without knowing all seven private inputs.
///
///         A nullifier is Poseidon(matric, institutionKey). It serves as the
///         revocation handle: RevocationRegistry checks nullifiers, and an active
///         nullifier means the credential is valid.
///
///         Batch registration is required. Individual student registration is not
///         supported. This keeps gas costs low and prevents spam.
contract CredentialRegistry is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant BUNDLER_ROLE = keccak256("BUNDLER_ROLE");

    InstitutionRegistry public immutable registry;

    struct CredentialRecord {
        bytes32 commitment;
        bytes32 institutionId;
        uint16  graduationYear;
        uint8   degreeTypeCode;
        uint256 registeredAt;
    }

    // nullifier => CredentialRecord
    mapping(bytes32 => CredentialRecord) private _records;
    // commitment => nullifier (for reverse lookup)
    mapping(bytes32 => bytes32) private _commitmentToNullifier;
    // institution => list of nullifiers they have registered
    mapping(bytes32 => bytes32[]) private _institutionNullifiers;

    event BatchRegistered(
        bytes32 indexed institutionId,
        uint256 count,
        uint16  graduationYear,
        bytes32 txRef
    );

    error NotFound(bytes32 nullifier);
    error AlreadyRegistered(bytes32 nullifier);
    error InstitutionNotActive(bytes32 institutionId);
    error CallerNotInstitutionAdmin(bytes32 institutionId, address caller);
    error ArrayLengthMismatch();
    error EmptyBatch();

    constructor(address platformAdmin, address institutionRegistryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, platformAdmin);
        _grantRole(BUNDLER_ROLE, platformAdmin);
        registry = InstitutionRegistry(institutionRegistryAddress);
    }

    // ── External functions ────────────────────────────────────────────────────

    /// @notice Registers a batch of credential commitments and nullifiers.
    ///         The caller must be the admin wallet of the named institution.
    ///         txRef is an off-chain reference (e.g. batch database ID hash) for
    ///         the backend to match the event to its job record.
    function registerBatch(
        bytes32          institutionId,
        bytes32[] calldata commitments,
        bytes32[] calldata nullifiers,
        uint16           graduationYear,
        uint8            degreeTypeCode,
        bytes32          txRef
    ) external nonReentrant whenNotPaused {
        if (commitments.length == 0) revert EmptyBatch();
        if (commitments.length != nullifiers.length) revert ArrayLengthMismatch();
        if (!registry.isActive(institutionId)) revert InstitutionNotActive(institutionId);
        if (registry.getAdminWallet(institutionId) != msg.sender && !hasRole(BUNDLER_ROLE, msg.sender)) {
            revert CallerNotInstitutionAdmin(institutionId, msg.sender);
        }

        uint256 count = commitments.length;
        for (uint256 i = 0; i < count; ) {
            bytes32 nullifier  = nullifiers[i];
            bytes32 commitment = commitments[i];

            // Checks
            if (_records[nullifier].registeredAt != 0) revert AlreadyRegistered(nullifier);

            // Effects
            _records[nullifier] = CredentialRecord({
                commitment:    commitment,
                institutionId: institutionId,
                graduationYear: graduationYear,
                degreeTypeCode: degreeTypeCode,
                registeredAt:  block.timestamp
            });
            _commitmentToNullifier[commitment] = nullifier;
            _institutionNullifiers[institutionId].push(nullifier);

            unchecked { ++i; }
        }

        emit BatchRegistered(institutionId, count, graduationYear, txRef);
    }

    // ── View functions ────────────────────────────────────────────────────────

    function getRecord(bytes32 nullifier) external view returns (CredentialRecord memory) {
        if (_records[nullifier].registeredAt == 0) revert NotFound(nullifier);
        return _records[nullifier];
    }

    function exists(bytes32 nullifier) external view returns (bool) {
        return _records[nullifier].registeredAt != 0;
    }

    function getCommitment(bytes32 nullifier) external view returns (bytes32) {
        return _records[nullifier].commitment;
    }

    function getNullifierForCommitment(bytes32 commitment) external view returns (bytes32) {
        return _commitmentToNullifier[commitment];
    }

    function getInstitutionNullifiers(bytes32 institutionId)
        external view returns (bytes32[] memory)
    {
        return _institutionNullifiers[institutionId];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    function pause()   external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
