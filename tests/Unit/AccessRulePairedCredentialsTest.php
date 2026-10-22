<?php

namespace Tests\Unit;

use App\Models\AccessRule;
use PHPUnit\Framework\TestCase;

/**
 * One passcode per email address.
 *
 * An email allow-list and a passcode list are independent conditions — any
 * listed code opens the lock for any listed address. This type asks the paired
 * question instead, so the crossed case (a real customer using a real code that
 * was issued to somebody else) is the one that matters most here.
 *
 * The splitting rules must match splitPair() in the storefront validator, the
 * checkout Function and resources/js/lib/pairList.js.
 */
class AccessRulePairedCredentialsTest extends TestCase
{
    private const PAIRS = "alice@x.com,AAA-1\nbob@x.com,BBB-2\ncarol@x.com,CCC-3";

    private function rule(string $value): AccessRule
    {
        $rule = new AccessRule();
        $rule->conditions = [[
            'operator' => 'OR',
            'conditions' => [['type' => 'pairedCredentials', 'value' => $value]],
        ]];

        return $rule;
    }

    public function test_a_passcode_only_works_for_the_address_it_was_issued_to(): void
    {
        $rule = $this->rule(self::PAIRS);

        $this->assertTrue($rule->checkAccess(['email' => 'alice@x.com', 'passcode' => 'AAA-1']));
        $this->assertTrue($rule->checkAccess(['email' => 'bob@x.com', 'passcode' => 'BBB-2']));
        $this->assertFalse(
            $rule->checkAccess(['email' => 'alice@x.com', 'passcode' => 'BBB-2']),
            "another customer's code must not work"
        );
        $this->assertFalse($rule->checkAccess(['email' => 'mallory@x.com', 'passcode' => 'AAA-1']));
    }

    public function test_the_address_is_matched_case_insensitively_but_the_code_is_not(): void
    {
        $rule = $this->rule(self::PAIRS);

        $this->assertTrue($rule->checkAccess(['email' => 'ALICE@X.com', 'passcode' => 'AAA-1']));
        $this->assertFalse($rule->checkAccess(['email' => 'alice@x.com', 'passcode' => 'aaa-1']));
    }

    public function test_both_halves_are_required(): void
    {
        $rule = $this->rule(self::PAIRS);

        $this->assertFalse($rule->checkAccess(['email' => 'alice@x.com', 'passcode' => '']));
        $this->assertFalse($rule->checkAccess(['email' => '', 'passcode' => 'AAA-1']));
        $this->assertFalse($rule->checkAccess([]));
    }

    public function test_surrounding_whitespace_never_decides_access(): void
    {
        $rule = $this->rule("  alice@x.com , AAA-1  \n\nbob@x.com,BBB-2");

        $this->assertTrue($rule->checkAccess(['email' => ' alice@x.com ', 'passcode' => ' AAA-1 ']));
    }

    public function test_only_the_first_separator_splits_a_line(): void
    {
        // An email contains no separator, so everything after the first one is
        // the passcode — a code with a comma in it survives the round trip.
        $rule = $this->rule('erin@x.com,VIP,24');

        $this->assertTrue($rule->checkAccess(['email' => 'erin@x.com', 'passcode' => 'VIP,24']));
        $this->assertFalse($rule->checkAccess(['email' => 'erin@x.com', 'passcode' => 'VIP']));
    }

    public function test_semicolon_tab_and_colon_separate_a_pair_too(): void
    {
        foreach (["dan@x.com;D-1", "dan@x.com\tD-1", 'dan@x.com:D-1'] as $line) {
            $this->assertTrue(
                $this->rule($line)->checkAccess(['email' => 'dan@x.com', 'passcode' => 'D-1']),
                $line
            );
        }
    }

    public function test_a_two_hundred_pair_list_matches_first_last_and_nothing_crossed(): void
    {
        $lines = [];
        for ($i = 0; $i < 200; $i++) {
            $lines[] = "customer{$i}@example.com,CODE-{$i}";
        }
        $rule = $this->rule(implode("\n", $lines));

        $this->assertTrue($rule->checkAccess(['email' => 'customer0@example.com', 'passcode' => 'CODE-0']));
        $this->assertTrue($rule->checkAccess(['email' => 'customer199@example.com', 'passcode' => 'CODE-199']));
        $this->assertFalse($rule->checkAccess(['email' => 'customer0@example.com', 'passcode' => 'CODE-199']));
    }
}
