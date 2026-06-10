// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";

contract InstitutionRegistryTest is Test {
    InstitutionRegistry reg;
    address admin   = makeAddr("admin");
    address alice   = makeAddr("alice");
    address bob     = makeAddr("bob");

    bytes32 constant ID  = keccak256("futminna");
    bytes   constant KEY = hex"04aabbcc";

    function setUp() public {
        reg = new InstitutionRegistry(admin);
    }

    function test_register_succeeds() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "Federal University of Technology Minna", alice, KEY);

        InstitutionRegistry.Institution memory inst = reg.getInstitution(ID);
        assertEq(inst.name, "Federal University of Technology Minna");
        assertEq(inst.adminWallet, alice);
        assertTrue(inst.active);
    }

    function test_register_reverts_duplicate() public {
        vm.startPrank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);
        vm.expectRevert(abi.encodeWithSelector(InstitutionRegistry.AlreadyRegistered.selector, ID));
        reg.registerInstitution(ID, "FUTMinna again", alice, KEY);
        vm.stopPrank();
    }

    function test_register_reverts_zero_wallet() public {
        vm.prank(admin);
        vm.expectRevert(InstitutionRegistry.ZeroAddress.selector);
        reg.registerInstitution(ID, "X", address(0), KEY);
    }

    function test_deactivate_and_reactivate() public {
        vm.startPrank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);
        assertTrue(reg.isActive(ID));

        reg.deactivateInstitution(ID);
        assertFalse(reg.isActive(ID));

        reg.reactivateInstitution(ID);
        assertTrue(reg.isActive(ID));
        vm.stopPrank();
    }

    function test_rotate_key_by_admin_wallet() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);

        bytes memory newKey = hex"04ddeeff";
        vm.prank(alice);
        reg.rotatePublicKey(ID, newKey);

        assertEq(reg.getPublicKey(ID), newKey);
    }

    function test_rotate_key_reverts_wrong_caller() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(InstitutionRegistry.CallerNotAdmin.selector, ID, bob)
        );
        reg.rotatePublicKey(ID, hex"04ddee");
    }

    function test_non_admin_cannot_register() public {
        vm.prank(alice);
        vm.expectRevert();
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);
    }

    function test_get_all_ids() public {
        bytes32 id2 = keccak256("unn");
        vm.startPrank(admin);
        reg.registerInstitution(ID,  "FUTMinna", alice, KEY);
        reg.registerInstitution(id2, "UNN",      bob,   KEY);
        vm.stopPrank();

        bytes32[] memory ids = reg.getAllIds();
        assertEq(ids.length, 2);
    }

    function test_pause_prevents_registration() public {
        vm.prank(admin);
        reg.pause();

        vm.prank(admin);
        vm.expectRevert();
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);
    }

    function testFuzz_register_any_id(bytes32 id, address wallet) public {
        vm.assume(wallet != address(0));
        vm.prank(admin);
        reg.registerInstitution(id, "Any University", wallet, KEY);
        assertTrue(reg.isActive(id));
    }

    // ── Gas Cost Tests ────────────────────────────────────────────────────────

    /// @notice Measures gas cost for registering a single institution
    function test_gas_register_single_institution() public {
        uint256 gasBefore = gasleft();
        
        vm.prank(admin);
        reg.registerInstitution(ID, "Federal University of Technology Minna", alice, KEY);
        
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas used for single institution registration:", gasUsed);
        
        // Assert reasonable gas usage (should be under 300k gas for first registration)
        // First registration costs more due to storage initialization
        assertLt(gasUsed, 300_000, "Registration gas too high");
    }

    /// @notice Measures gas cost for key rotation
    function test_gas_rotate_public_key() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);

        bytes memory newKey = hex"04ddeeff11223344";
        
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        reg.rotatePublicKey(ID, newKey);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for key rotation:", gasUsed);
        assertLt(gasUsed, 100_000, "Key rotation gas too high");
    }

    /// @notice Measures gas cost for deactivation
    function test_gas_deactivate_institution() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);

        uint256 gasBefore = gasleft();
        vm.prank(admin);
        reg.deactivateInstitution(ID);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for deactivation:", gasUsed);
        assertLt(gasUsed, 50_000, "Deactivation gas too high");
    }

    /// @notice Measures gas cost for multiple institution registrations
    function test_gas_register_multiple_institutions() public {
        bytes32[] memory ids = new bytes32[](5);
        ids[0] = keccak256("futminna");
        ids[1] = keccak256("unn");
        ids[2] = keccak256("unilag");
        ids[3] = keccak256("ui");
        ids[4] = keccak256("abu");

        uint256 totalGas = 0;
        
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 gasBefore = gasleft();
            
            vm.prank(admin);
            reg.registerInstitution(
                ids[i],
                string(abi.encodePacked("University ", vm.toString(i))),
                alice,
                KEY
            );
            
            uint256 gasUsed = gasBefore - gasleft();
            totalGas += gasUsed;
            console.log("Gas for institution", i, ":", gasUsed);
        }
        
        uint256 avgGas = totalGas / ids.length;
        console.log("Average gas per institution:", avgGas);
        console.log("Total gas for 5 institutions:", totalGas);
    }

    // ── Time Measurement Tests ────────────────────────────────────────────────

    /// @notice Measures execution time for institution registration
    function test_time_register_institution() public {
        uint256 startTime = block.timestamp;
        
        vm.prank(admin);
        reg.registerInstitution(ID, "Federal University of Technology Minna", alice, KEY);
        
        // In tests, block.timestamp doesn't auto-increment, so we warp forward
        vm.warp(block.timestamp + 1);
        uint256 endTime = block.timestamp;
        
        console.log("Block timestamp at start:", startTime);
        console.log("Block timestamp at end:", endTime);
        console.log("Time elapsed (blocks):", endTime - startTime);
        
        // Verify the registration timestamp is correct
        InstitutionRegistry.Institution memory inst = reg.getInstitution(ID);
        assertEq(inst.registeredAt, startTime);
    }

    /// @notice Measures time for batch operations
    function test_time_batch_operations() public {
        bytes32[] memory ids = new bytes32[](10);
        for (uint256 i = 0; i < 10; i++) {
            ids[i] = keccak256(abi.encodePacked("institution", i));
        }

        uint256 startTime = block.timestamp;
        
        vm.startPrank(admin);
        for (uint256 i = 0; i < ids.length; i++) {
            reg.registerInstitution(
                ids[i],
                string(abi.encodePacked("University ", vm.toString(i))),
                alice,
                KEY
            );
            // Simulate time passing between registrations
            vm.warp(block.timestamp + 1);
        }
        vm.stopPrank();
        
        uint256 endTime = block.timestamp;
        uint256 totalTime = endTime - startTime;
        
        console.log("Total time for 10 registrations (blocks):", totalTime);
        console.log("Average time per registration (blocks):", totalTime / 10);
    }

    // ── Gas Snapshot Tests ────────────────────────────────────────────────────
    // Run with: forge snapshot --match-test test_snapshot

    /// @notice Creates gas snapshot for registration
    function test_snapshot_register() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "Federal University of Technology Minna", alice, KEY);
    }

    /// @notice Creates gas snapshot for key rotation
    function test_snapshot_rotate_key() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);
        
        vm.prank(alice);
        reg.rotatePublicKey(ID, hex"04ddeeff");
    }

    /// @notice Creates gas snapshot for deactivation
    function test_snapshot_deactivate() public {
        vm.prank(admin);
        reg.registerInstitution(ID, "FUTMinna", alice, KEY);
        
        vm.prank(admin);
        reg.deactivateInstitution(ID);
    }
}
