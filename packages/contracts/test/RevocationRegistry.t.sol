// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {CredentialRegistry} from "../src/CredentialRegistry.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";

contract RevocationRegistryTest is Test {
    InstitutionRegistry instReg;
    CredentialRegistry  credReg;
    RevocationRegistry  revReg;

    address admin             = makeAddr("admin");
    address institutionAdmin  = makeAddr("institutionAdmin");
    address alice             = makeAddr("alice");

    bytes32 constant INST_ID   = keccak256("futminna");
    bytes   constant PUBLIC_KEY = hex"04aabbcc";

    bytes32 nullifier;
    bytes32 commitment;

    function setUp() public {
        instReg = new InstitutionRegistry(admin);
        credReg = new CredentialRegistry(admin, address(instReg));
        revReg  = new RevocationRegistry(admin, address(instReg), address(credReg));

        // Register institution
        vm.prank(admin);
        instReg.registerInstitution(INST_ID, "FUTMinna", institutionAdmin, PUBLIC_KEY);

        // Register one credential
        commitment = keccak256("commitment1");
        nullifier  = keccak256("nullifier1");

        bytes32[] memory commitments = new bytes32[](1);
        bytes32[] memory nullifiers  = new bytes32[](1);
        commitments[0] = commitment;
        nullifiers[0]  = nullifier;

        vm.prank(institutionAdmin);
        credReg.registerBatch(INST_ID, commitments, nullifiers, 2024, 1, keccak256("batch1"));
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    function test_revoke_credential_succeeds() public {
        assertFalse(revReg.isRevoked(nullifier));

        vm.prank(institutionAdmin);
        revReg.revokeCredential(nullifier, 1);

        assertTrue(revReg.isRevoked(nullifier));
    }

    function test_revoke_emits_event() public {
        vm.expectEmit(true, true, false, true);
        emit RevocationRegistry.CredentialRevoked(nullifier, INST_ID, 1);

        vm.prank(institutionAdmin);
        revReg.revokeCredential(nullifier, 1);
    }

    function test_get_revocation_returns_correct_data() public {
        vm.prank(institutionAdmin);
        revReg.revokeCredential(nullifier, 3);

        RevocationRegistry.Revocation memory rev = revReg.getRevocation(nullifier);
        assertEq(rev.nullifier, nullifier);
        assertEq(rev.institutionId, INST_ID);
        assertEq(rev.reasonCode, 3);
        assertGt(rev.revokedAt, 0);
    }

    function test_get_all_revoked_nullifiers() public {
        // Register and revoke a second credential
        bytes32 nullifier2  = keccak256("nullifier2");
        bytes32 commitment2 = keccak256("commitment2");

        bytes32[] memory c2 = new bytes32[](1);
        bytes32[] memory n2 = new bytes32[](1);
        c2[0] = commitment2;
        n2[0] = nullifier2;

        vm.prank(institutionAdmin);
        credReg.registerBatch(INST_ID, c2, n2, 2024, 1, keccak256("batch2"));

        vm.startPrank(institutionAdmin);
        revReg.revokeCredential(nullifier, 1);
        revReg.revokeCredential(nullifier2, 2);
        vm.stopPrank();

        bytes32[] memory all = revReg.getAllRevokedNullifiers();
        assertEq(all.length, 2);
    }

    // ── Revert paths ──────────────────────────────────────────────────────────

    function test_revoke_reverts_already_revoked() public {
        vm.startPrank(institutionAdmin);
        revReg.revokeCredential(nullifier, 1);

        vm.expectRevert(
            abi.encodeWithSelector(RevocationRegistry.AlreadyRevoked.selector, nullifier)
        );
        revReg.revokeCredential(nullifier, 1);
        vm.stopPrank();
    }

    function test_revoke_reverts_wrong_caller() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                RevocationRegistry.CallerNotInstitutionAdmin.selector,
                INST_ID,
                alice
            )
        );
        revReg.revokeCredential(nullifier, 1);
    }

    function test_revoke_reverts_nonexistent_nullifier() public {
        bytes32 fakeNullifier = keccak256("does-not-exist");
        vm.prank(institutionAdmin);
        // getRecord will revert with NotFound from CredentialRegistry
        vm.expectRevert();
        revReg.revokeCredential(fakeNullifier, 1);
    }

    function test_revoke_reverts_inactive_institution() public {
        vm.prank(admin);
        instReg.deactivateInstitution(INST_ID);

        vm.prank(institutionAdmin);
        vm.expectRevert(
            abi.encodeWithSelector(RevocationRegistry.InstitutionNotActive.selector, INST_ID)
        );
        revReg.revokeCredential(nullifier, 1);
    }

    // ── Reason code coverage ──────────────────────────────────────────────────

    function test_all_reason_codes_accepted() public {
        // Register 5 credentials, one per reason code
        for (uint8 code = 1; code <= 5; code++) {
            bytes32 n = keccak256(abi.encodePacked("nullifier-reason", code));
            bytes32 c = keccak256(abi.encodePacked("commitment-reason", code));

            bytes32[] memory cs = new bytes32[](1);
            bytes32[] memory ns = new bytes32[](1);
            cs[0] = c;
            ns[0] = n;

            vm.prank(institutionAdmin);
            credReg.registerBatch(
                INST_ID, cs, ns, 2024, 1,
                keccak256(abi.encodePacked("batch-reason", code))
            );

            vm.prank(institutionAdmin);
            revReg.revokeCredential(n, code);

            assertTrue(revReg.isRevoked(n));
            assertEq(revReg.getRevocation(n).reasonCode, code);
        }
    }

    // ── Gas measurement ───────────────────────────────────────────────────────

    function test_gas_revoke_credential() public {
        uint256 gasBefore = gasleft();
        vm.prank(institutionAdmin);
        revReg.revokeCredential(nullifier, 1);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for revokeCredential:", gasUsed);
        // revokeCredential makes two cross-contract staticcalls (CredentialRegistry
        // + InstitutionRegistry) plus a storage write, so ~170k gas is expected.
        assertLt(gasUsed, 250_000, "Revocation gas too high");
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────

    function testFuzz_revoke_any_reason_code(uint8 reasonCode) public {
        vm.assume(reasonCode >= 1 && reasonCode <= 5);
        vm.prank(institutionAdmin);
        revReg.revokeCredential(nullifier, reasonCode);
        assertTrue(revReg.isRevoked(nullifier));
    }
}
