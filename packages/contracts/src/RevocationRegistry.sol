// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {InstitutionRegistry} from "./InstitutionRegistry.sol";
import {CredentialRegistry} from "./CredentialRegistry.sol";

/// @title RevocationRegistry
/// @notice An append-only registry of revoked credential nullifiers.
///
///         Once a nullifier is added to this registry, any ZKP proof that
///         references it as a public input will be checked against this
///         registry before on-chain verification is attempted. The backend
///         performs this check via isRevoked() before generating any proof.
///
///         Only the admin wallet of the institution that originally registered
///         the nullifier may revoke it. This prevents one institution from
///         revoking another institution's credentials.
contract RevocationRegistry is AccessControl {
    bytes32 public constant PLATFORM_ADMIN_ROLE = keccak256("PLATFORM_ADMIN_ROLE");

    InstitutionRegistry public immutable instRegistry;
    CredentialRegistry  public immutable credRegistry;

    struct Revocation {
        bytes32 nullifier;
        bytes32 institutionId;
        uint8   reasonCode;
        uint256 revokedAt;
    }

    // nullifier => Revocation (zero revokedAt means not revoked)
    mapping(bytes32 => Revocation) private _revocations;
    bytes32[] private _revokedNullifiers;

    event CredentialRevoked(
        bytes32 indexed nullifier,
        bytes32 indexed institutionId,
        uint8   reasonCode
    );

    error NotFound(bytes32 nullifier);
    error AlreadyRevoked(bytes32 nullifier);
    error InstitutionNotActive(bytes32 institutionId);
    error CallerNotInstitutionAdmin(bytes32 institutionId, address caller);
    error WrongInstitution(bytes32 nullifier, bytes32 expectedInstitution);

    // Reason codes used in the frontend:
    // 1 = Data entry error corrected
    // 2 = Student re-enrolled
    // 3 = Credential fraud detected
    // 4 = Institutional error
    // 5 = Other (described in off-chain audit record)

    constructor(address platformAdmin, address instReg, address credReg) {
        _grantRole(DEFAULT_ADMIN_ROLE, platformAdmin);
        _grantRole(PLATFORM_ADMIN_ROLE, platformAdmin);
        instRegistry = InstitutionRegistry(instReg);
        credRegistry = CredentialRegistry(credReg);
    }

    // ── External functions ────────────────────────────────────────────────────

    /// @notice Revokes a credential. The caller must be the admin wallet of the
    ///         institution that registered the nullifier.
    function revokeCredential(bytes32 nullifier, uint8 reasonCode) external {
        // Verify the credential exists in the CredentialRegistry
        CredentialRegistry.CredentialRecord memory record = credRegistry.getRecord(nullifier);

        bytes32 institutionId = record.institutionId;

        if (!instRegistry.isActive(institutionId)) revert InstitutionNotActive(institutionId);
        if (instRegistry.getAdminWallet(institutionId) != msg.sender) {
            revert CallerNotInstitutionAdmin(institutionId, msg.sender);
        }
        if (_revocations[nullifier].revokedAt != 0) revert AlreadyRevoked(nullifier);

        _revocations[nullifier] = Revocation({
            nullifier:     nullifier,
            institutionId: institutionId,
            reasonCode:    reasonCode,
            revokedAt:     block.timestamp
        });
        _revokedNullifiers.push(nullifier);

        emit CredentialRevoked(nullifier, institutionId, reasonCode);
    }

    // ── View functions ────────────────────────────────────────────────────────

    function isRevoked(bytes32 nullifier) external view returns (bool) {
        return _revocations[nullifier].revokedAt != 0;
    }

    function getRevocation(bytes32 nullifier) external view returns (Revocation memory) {
        return _revocations[nullifier];
    }

    function getAllRevokedNullifiers() external view returns (bytes32[] memory) {
        return _revokedNullifiers;
    }
}
