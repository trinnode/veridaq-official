// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {PaymasterVault} from "../src/PaymasterVault.sol";
import {SubscriptionManager} from "../src/SubscriptionManager.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {IEntryPoint} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

// ── Minimal EntryPoint mock ───────────────────────────────────────────────────
// We only need depositTo, withdrawTo, and balanceOf for these tests.
contract MockEntryPoint {
    mapping(address => uint256) public deposits;

    function depositTo(address account) external payable {
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        require(deposits[msg.sender] >= withdrawAmount, "Insufficient deposit");
        deposits[msg.sender] -= withdrawAmount;
        (bool ok,) = withdrawAddress.call{value: withdrawAmount}("");
        require(ok, "Transfer failed");
    }

    function balanceOf(address account) external view returns (uint256) {
        return deposits[account];
    }

    // Stub — not used in these tests
    function getNonce(address, uint192) external pure returns (uint256) { return 0; }
    function getUserOpHash(bytes calldata) external pure returns (bytes32) { return bytes32(0); }

    receive() external payable {}
}

// ── Test contract ─────────────────────────────────────────────────────────────

contract PaymasterVaultTest is Test {
    MockEntryPoint      entryPoint;
    SubscriptionManager subManager;
    InstitutionRegistry instReg;
    PaymasterVault      vault;

    address admin            = makeAddr("admin");
    address institutionAdmin = makeAddr("institutionAdmin");
    address alice            = makeAddr("alice");

    bytes32 constant INST_ID    = keccak256("futminna");
    bytes32 constant INST_PAID  = keccak256("paid-inst");
    bytes   constant PUBLIC_KEY = hex"04aabbcc";

    function setUp() public {
        entryPoint = new MockEntryPoint();
        subManager = new SubscriptionManager(admin);
        instReg    = new InstitutionRegistry(admin);
        vault      = new PaymasterVault(address(entryPoint), address(subManager), admin);

        // Register a FREE-tier institution
        vm.prank(admin);
        instReg.registerInstitution(INST_ID, "FUTMinna", institutionAdmin, PUBLIC_KEY);

        // Register a PAID-tier institution
        vm.prank(admin);
        instReg.registerInstitution(INST_PAID, "Paid Uni", institutionAdmin, PUBLIC_KEY);
        vm.prank(admin);
        subManager.setInstitutionTier(INST_PAID, SubscriptionManager.InstitutionTier.PAID);

        // Fund the vault so the EntryPoint mock has a balance
        vm.deal(admin, 10 ether);
    }

    // ── Sponsored pool funding ────────────────────────────────────────────────

    function test_fund_sponsored_pool() public {
        vm.prank(admin);
        vault.fundSponsoredPool{value: 1 ether}();

        assertEq(vault.sponsoredPool(), 1 ether);
    }

    function test_fund_sponsored_pool_emits_event() public {
        vm.expectEmit(true, false, false, true);
        emit PaymasterVault.SponsoredPoolFunded(admin, 1 ether);

        vm.prank(admin);
        vault.fundSponsoredPool{value: 1 ether}();
    }

    function test_fund_sponsored_pool_reverts_zero() public {
        vm.prank(admin);
        vm.expectRevert(PaymasterVault.ZeroAmount.selector);
        vault.fundSponsoredPool{value: 0}();
    }

    function test_fund_sponsored_pool_reverts_non_admin() public {
        // Give alice ETH so the call reaches the access control check
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vm.expectRevert();
        vault.fundSponsoredPool{value: 1 ether}();
    }

    // ── Institution funding ───────────────────────────────────────────────────

    function test_fund_institution() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);

        assertEq(vault.institutionBalances(INST_PAID), 1 ether);
    }

    function test_fund_institution_emits_event() public {
        vm.deal(alice, 1 ether);
        vm.expectEmit(true, true, false, true);
        emit PaymasterVault.InstitutionFunded(INST_PAID, alice, 0.5 ether);

        vm.prank(alice);
        vault.fundInstitution{value: 0.5 ether}(INST_PAID);
    }

    function test_fund_institution_reverts_zero() public {
        vm.prank(alice);
        vm.expectRevert(PaymasterVault.ZeroAmount.selector);
        vault.fundInstitution{value: 0}(INST_PAID);
    }

    // ── Institution withdrawal ────────────────────────────────────────────────

    function test_institution_admin_can_withdraw_own_balance() public {
        // Fund the institution balance
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);

        // institutionAdmin is the registered admin wallet for INST_PAID
        uint256 balanceBefore = institutionAdmin.balance;

        vm.prank(institutionAdmin);
        vault.withdrawInstitutionBalance(
            INST_PAID,
            payable(institutionAdmin),
            0.5 ether,
            address(instReg)
        );

        assertEq(vault.institutionBalances(INST_PAID), 0.5 ether);
        assertEq(institutionAdmin.balance, balanceBefore + 0.5 ether);
    }

    function test_platform_admin_can_withdraw_institution_balance() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);

        vm.prank(admin);
        vault.withdrawInstitutionBalance(
            INST_PAID,
            payable(admin),
            0.3 ether,
            address(instReg)
        );

        assertEq(vault.institutionBalances(INST_PAID), 0.7 ether);
    }

    function test_withdrawal_reverts_wrong_caller() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);

        // alice is not the institution admin wallet
        vm.prank(alice);
        vm.expectRevert("Caller is not institution admin wallet");
        vault.withdrawInstitutionBalance(
            INST_PAID,
            payable(alice),
            0.5 ether,
            address(instReg)
        );
    }

    function test_withdrawal_reverts_insufficient_balance() public {
        vm.prank(institutionAdmin);
        vm.expectRevert(
            abi.encodeWithSelector(
                PaymasterVault.InsufficientInstitutionBalance.selector,
                INST_PAID,
                1 ether,
                0
            )
        );
        vault.withdrawInstitutionBalance(
            INST_PAID,
            payable(institutionAdmin),
            1 ether,
            address(instReg)
        );
    }

    // ── Emergency withdrawal ──────────────────────────────────────────────────

    function test_emergency_withdraw_sponsored_pool() public {
        vm.prank(admin);
        vault.fundSponsoredPool{value: 2 ether}();

        uint256 adminBalBefore = admin.balance;

        vm.prank(admin);
        vault.emergencyWithdrawSponsoredPool(payable(admin));

        assertEq(vault.sponsoredPool(), 0);
        assertEq(admin.balance, adminBalBefore + 2 ether);
    }

    function test_emergency_withdraw_reverts_zero_pool() public {
        vm.prank(admin);
        vm.expectRevert(PaymasterVault.ZeroAmount.selector);
        vault.emergencyWithdrawSponsoredPool(payable(admin));
    }

    function test_emergency_withdraw_reverts_non_admin() public {
        vm.prank(admin);
        vault.fundSponsoredPool{value: 1 ether}();

        vm.prank(alice);
        vm.expectRevert();
        vault.emergencyWithdrawSponsoredPool(payable(alice));
    }

    // ── validatePaymasterUserOp ───────────────────────────────────────────────

    function test_validate_paymaster_user_op_free_tier_draws_from_sponsored_pool() public {
        // Fund the sponsored pool
        vm.prank(admin);
        vault.fundSponsoredPool{value: 2 ether}();

        uint256 maxCost = 0.1 ether;

        // Encode paymasterAndData: [address(vault)][INST_ID][batchSize=10]
        bytes memory paymasterAndData = abi.encodePacked(
            address(vault),
            abi.encode(INST_ID, uint256(10))
        );

        // Only the EntryPoint can call validatePaymasterUserOp
        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) =
            vault.validatePaymasterUserOp(paymasterAndData, maxCost);

        assertEq(validationData, 0); // 0 = valid
        assertEq(vault.sponsoredPool(), 2 ether - maxCost);

        // Context should decode correctly
        (bytes32 instId, bool isSponsored, uint256 reserved) =
            abi.decode(context, (bytes32, bool, uint256));
        assertEq(instId, INST_ID);
        assertTrue(isSponsored);
        assertEq(reserved, maxCost);
    }

    function test_validate_paymaster_user_op_paid_tier_draws_from_institution_balance() public {
        // Fund the institution balance
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);

        uint256 maxCost = 0.1 ether;

        bytes memory paymasterAndData = abi.encodePacked(
            address(vault),
            abi.encode(INST_PAID, uint256(10))
        );

        vm.prank(address(entryPoint));
        (bytes memory context, uint256 validationData) =
            vault.validatePaymasterUserOp(paymasterAndData, maxCost);

        assertEq(validationData, 0);
        assertEq(vault.institutionBalances(INST_PAID), 1 ether - maxCost);

        (, bool isSponsored,) = abi.decode(context, (bytes32, bool, uint256));
        assertFalse(isSponsored);
    }

    function test_validate_reverts_insufficient_sponsored_pool() public {
        // Pool is empty
        uint256 maxCost = 0.1 ether;
        bytes memory paymasterAndData = abi.encodePacked(
            address(vault),
            abi.encode(INST_ID, uint256(10))
        );

        vm.prank(address(entryPoint));
        vm.expectRevert(
            abi.encodeWithSelector(
                PaymasterVault.InsufficientSponsoredPool.selector,
                maxCost,
                0
            )
        );
        vault.validatePaymasterUserOp(paymasterAndData, maxCost);
    }

    function test_validate_reverts_non_entry_point() public {
        bytes memory paymasterAndData = abi.encodePacked(
            address(vault),
            abi.encode(INST_ID, uint256(10))
        );

        vm.prank(alice);
        vm.expectRevert(PaymasterVault.OnlyEntryPoint.selector);
        vault.validatePaymasterUserOp(paymasterAndData, 0.1 ether);
    }

    // ── postOp ────────────────────────────────────────────────────────────────

    function test_post_op_refunds_sponsored_pool() public {
        vm.prank(admin);
        vault.fundSponsoredPool{value: 1 ether}();

        uint256 maxCost    = 0.1 ether;
        uint256 actualCost = 0.06 ether;
        uint256 refund     = maxCost - actualCost;

        // Simulate validatePaymasterUserOp reserving maxCost
        bytes memory paymasterAndData = abi.encodePacked(
            address(vault),
            abi.encode(INST_ID, uint256(10))
        );
        vm.prank(address(entryPoint));
        (bytes memory context,) = vault.validatePaymasterUserOp(paymasterAndData, maxCost);

        uint256 poolAfterValidate = vault.sponsoredPool();

        // postOp should refund the unused gas
        vm.prank(address(entryPoint));
        vault.postOp(0, context, actualCost);

        assertEq(vault.sponsoredPool(), poolAfterValidate + refund);
    }

    function test_post_op_refunds_institution_balance() public {
        vm.deal(alice, 2 ether);
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);

        uint256 maxCost    = 0.1 ether;
        uint256 actualCost = 0.07 ether;
        uint256 refund     = maxCost - actualCost;

        bytes memory paymasterAndData = abi.encodePacked(
            address(vault),
            abi.encode(INST_PAID, uint256(10))
        );
        vm.prank(address(entryPoint));
        (bytes memory context,) = vault.validatePaymasterUserOp(paymasterAndData, maxCost);

        uint256 balAfterValidate = vault.institutionBalances(INST_PAID);

        vm.prank(address(entryPoint));
        vault.postOp(0, context, actualCost);

        assertEq(vault.institutionBalances(INST_PAID), balAfterValidate + refund);
    }

    // ── Gas measurement ───────────────────────────────────────────────────────

    function test_gas_fund_institution() public {
        vm.deal(alice, 2 ether);
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        vault.fundInstitution{value: 1 ether}(INST_PAID);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for fundInstitution:", gasUsed);
        assertLt(gasUsed, 100_000, "fundInstitution gas too high");
    }

    // ── receive() ─────────────────────────────────────────────────────────────

    function test_receive_adds_to_sponsored_pool() public {
        vm.deal(alice, 1 ether);
        vm.prank(alice);
        (bool ok,) = address(vault).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(vault.sponsoredPool(), 0.5 ether);
    }
}
