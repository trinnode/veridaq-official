// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";

contract SubscriptionManagerTest is Test {
    SubscriptionManager sub;

    address admin   = makeAddr("admin");
    address bundler = makeAddr("bundler");
    address alice   = makeAddr("alice");
    address bob     = makeAddr("bob");

    bytes32 constant INST_ID  = keccak256("futminna");
    bytes32 constant INST_ID2 = keccak256("unn");

    function setUp() public {
        sub = new SubscriptionManager(admin);

        // Grant bundler role — admin holds DEFAULT_ADMIN_ROLE which is the
        // admin role for BUNDLER_ROLE, so this is authorised.
        // We read the role hash before pranking to avoid the staticcall
        // consuming the prank context.
        bytes32 bundlerRole = sub.BUNDLER_ROLE();
        vm.prank(admin);
        sub.grantRole(bundlerRole, bundler);
    }

    // ── Institution tier management ───────────────────────────────────────────

    function test_default_tier_is_free() public view {
        // Institutions start at FREE (enum value 0) by default
        assertEq(uint8(sub.institutionTiers(INST_ID)), 0);
    }

    function test_set_tier_to_paid() public {
        vm.prank(admin);
        sub.setInstitutionTier(INST_ID, SubscriptionManager.InstitutionTier.PAID);

        assertEq(uint8(sub.institutionTiers(INST_ID)), 1);
    }

    function test_set_tier_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit SubscriptionManager.TierChanged(INST_ID, SubscriptionManager.InstitutionTier.PAID);

        vm.prank(admin);
        sub.setInstitutionTier(INST_ID, SubscriptionManager.InstitutionTier.PAID);
    }

    function test_set_tier_reverts_same_tier() public {
        // Default is FREE; setting FREE again should revert
        vm.prank(admin);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionManager.TierAlreadySet.selector,
                INST_ID,
                SubscriptionManager.InstitutionTier.FREE
            )
        );
        sub.setInstitutionTier(INST_ID, SubscriptionManager.InstitutionTier.FREE);
    }

    function test_set_tier_reverts_non_admin() public {
        vm.prank(alice);
        vm.expectRevert();
        sub.setInstitutionTier(INST_ID, SubscriptionManager.InstitutionTier.PAID);
    }

    function test_should_sponsor_free_tier_small_batch() public {
        // FREE tier + batch <= 999 → should sponsor
        assertTrue(sub.shouldSponsor(INST_ID, 1));
        assertTrue(sub.shouldSponsor(INST_ID, 999));
    }

    function test_should_not_sponsor_free_tier_large_batch() public view {
        // FREE tier + batch > 999 → should NOT sponsor
        assertFalse(sub.shouldSponsor(INST_ID, 1000));
    }

    function test_should_not_sponsor_paid_tier() public {
        vm.prank(admin);
        sub.setInstitutionTier(INST_ID, SubscriptionManager.InstitutionTier.PAID);

        assertFalse(sub.shouldSponsor(INST_ID, 1));
        assertFalse(sub.shouldSponsor(INST_ID, 999));
    }

    // ── Employer free verification counter ───────────────────────────────────

    function test_initialise_employer_sets_free_verifications() public {
        assertFalse(sub.isEmployerInitialised(alice));

        vm.prank(admin);
        sub.initialiseEmployer(alice);

        assertTrue(sub.isEmployerInitialised(alice));
        assertEq(sub.freeVerificationsRemaining(alice), 3);
    }

    function test_initialise_employer_emits_event() public {
        vm.expectEmit(true, false, false, false);
        emit SubscriptionManager.EmployerInitialised(alice);

        vm.prank(admin);
        sub.initialiseEmployer(alice);
    }

    function test_consume_free_verification_decrements_counter() public {
        vm.prank(admin);
        sub.initialiseEmployer(alice);

        vm.prank(bundler);
        sub.consumeFreeVerification(alice);

        assertEq(sub.freeVerificationsRemaining(alice), 2);
    }

    function test_consume_all_three_free_verifications() public {
        vm.prank(admin);
        sub.initialiseEmployer(alice);

        vm.startPrank(bundler);
        sub.consumeFreeVerification(alice);
        sub.consumeFreeVerification(alice);
        sub.consumeFreeVerification(alice);
        vm.stopPrank();

        assertEq(sub.freeVerificationsRemaining(alice), 0);
    }

    function test_consume_emits_event() public {
        vm.prank(admin);
        sub.initialiseEmployer(alice);

        vm.expectEmit(true, false, false, true);
        emit SubscriptionManager.VerificationConsumed(alice, 2);

        vm.prank(bundler);
        sub.consumeFreeVerification(alice);
    }

    function test_consume_reverts_when_exhausted() public {
        vm.prank(admin);
        sub.initialiseEmployer(alice);

        vm.startPrank(bundler);
        sub.consumeFreeVerification(alice);
        sub.consumeFreeVerification(alice);
        sub.consumeFreeVerification(alice);

        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionManager.NoFreeVerificationsRemaining.selector,
                alice
            )
        );
        sub.consumeFreeVerification(alice);
        vm.stopPrank();
    }

    function test_consume_reverts_uninitialised_employer() public {
        vm.prank(bundler);
        vm.expectRevert(
            abi.encodeWithSelector(SubscriptionManager.EmployerNotInitialised.selector, bob)
        );
        sub.consumeFreeVerification(bob);
    }

    function test_consume_reverts_non_bundler() public {
        vm.prank(admin);
        sub.initialiseEmployer(alice);

        vm.prank(alice);
        vm.expectRevert();
        sub.consumeFreeVerification(alice);
    }

    // ── Multiple institutions ─────────────────────────────────────────────────

    function test_tiers_are_independent_per_institution() public {
        vm.prank(admin);
        sub.setInstitutionTier(INST_ID, SubscriptionManager.InstitutionTier.PAID);

        // INST_ID2 is still FREE
        assertEq(uint8(sub.institutionTiers(INST_ID)), 1);
        assertEq(uint8(sub.institutionTiers(INST_ID2)), 0);
    }

    // ── Gas measurement ───────────────────────────────────────────────────────

    function test_gas_initialise_employer() public {
        uint256 gasBefore = gasleft();
        vm.prank(admin);
        sub.initialiseEmployer(alice);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for initialiseEmployer:", gasUsed);
        assertLt(gasUsed, 80_000, "initialiseEmployer gas too high");
    }

    function test_gas_consume_free_verification() public {
        vm.prank(admin);
        sub.initialiseEmployer(alice);

        uint256 gasBefore = gasleft();
        vm.prank(bundler);
        sub.consumeFreeVerification(alice);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for consumeFreeVerification:", gasUsed);
        assertLt(gasUsed, 50_000, "consumeFreeVerification gas too high");
    }

    // ── Fuzz ──────────────────────────────────────────────────────────────────

    function testFuzz_should_sponsor_boundary(uint256 batchSize) public view {
        vm.assume(batchSize > 0 && batchSize <= 2000);
        bool expected = batchSize <= sub.FREE_TIER_BATCH_LIMIT();
        assertEq(sub.shouldSponsor(INST_ID, batchSize), expected);
    }
}
