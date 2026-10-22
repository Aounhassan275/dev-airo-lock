<?php

namespace Tests\Unit;

use App\Models\AccessRule;
use PHPUnit\Framework\TestCase;

/**
 * The list-valued conditions (a passcode list, an email allow-list) are the
 * ones merchants fill in bulk, so they carry hundreds of values in one string.
 * These cover the splitting and matching rules the storefront validator uses,
 * because the two must agree — a value visible in the admin that silently
 * fails to unlock is the worst outcome here.
 */
class AccessRuleListConditionsTest extends TestCase
{
    private function rule(array $condition): AccessRule
    {
        $rule = new AccessRule();
        $rule->conditions = [['operator' => 'OR', 'conditions' => [$condition]]];

        return $rule;
    }

    public function test_an_email_allow_list_matches_case_insensitively(): void
    {
        $rule = $this->rule(['type' => 'emailFromList', 'value' => "a@x.com\nB@X.com\nc@x.com"]);

        $this->assertTrue($rule->checkAccess(['email' => 'b@x.com']));
        $this->assertTrue($rule->checkAccess(['email' => 'A@X.com']));
        $this->assertFalse($rule->checkAccess(['email' => 'stranger@x.com']));
        $this->assertFalse($rule->checkAccess(['email' => '']));
    }

    public function test_a_two_hundred_entry_list_matches_first_last_and_neither(): void
    {
        $emails = [];
        for ($i = 0; $i < 200; $i++) {
            $emails[] = "customer{$i}@example.com";
        }
        $rule = $this->rule(['type' => 'emailFromList', 'value' => implode("\n", $emails)]);

        $this->assertTrue($rule->checkAccess(['email' => 'customer0@example.com']));
        $this->assertTrue($rule->checkAccess(['email' => 'customer199@example.com']));
        $this->assertFalse($rule->checkAccess(['email' => 'customer200@example.com']));
    }

    public function test_a_legacy_backslash_separated_save_still_splits(): void
    {
        // The old admin placeholder rendered a literal '\n', so some saves are
        // one line of backslash-separated values.
        $rule = $this->rule(['type' => 'passcodeFromList', 'value' => '123\\456\\789']);

        $this->assertTrue($rule->checkAccess(['passcode' => '456']));
        $this->assertFalse($rule->checkAccess(['passcode' => '999']));
    }

    public function test_surrounding_whitespace_never_decides_access(): void
    {
        $rule = $this->rule(['type' => 'multiplePasscodes', 'value' => "vip-1\n vip-2 \n\nvip-3"]);

        $this->assertTrue($rule->checkAccess(['passcode' => 'vip-2']), 'a stored value with stray spaces');
        $this->assertTrue($rule->checkAccess(['passcode' => ' vip-3 ']), 'a pasted entry with stray spaces');
        $this->assertFalse($rule->checkAccess(['passcode' => '']), 'a blank line is not a passcode');
    }

    public function test_passcodes_stay_case_sensitive(): void
    {
        $rule = $this->rule(['type' => 'multiplePasscodes', 'value' => "VIP-1\nVIP-2"]);

        $this->assertTrue($rule->checkAccess(['passcode' => 'VIP-1']));
        $this->assertFalse($rule->checkAccess(['passcode' => 'vip-1']));
    }
}
