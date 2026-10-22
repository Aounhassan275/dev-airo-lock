<?php

namespace Tests\Unit;

use App\Services\PopupTextBaker;
use PHPUnit\Framework\TestCase;

/**
 * A condition gets ONE baked label, and the storefront applies a label set on
 * a condition to that condition's FIRST field. 'pairedCredentials' renders two
 * fields of different kinds, so baking one label put "Enter Passcode" above the
 * email box — labelKeyFor() therefore refuses to bake for this type and lets
 * the popup label each field from its own key instead.
 */
class PopupTextBakerPairedLabelTest extends TestCase
{
    private const LOCALES = ['en', 'pt-PT', 'ur'];

    private function paired(array $overrides = []): array
    {
        return [[
            'operator' => 'AND',
            'conditions' => [array_merge(['type' => 'pairedCredentials', 'value' => 'a@x.com,A1'], $overrides)],
        ]];
    }

    private function label(array $conditions, int $index = 0): mixed
    {
        return $conditions[0]['conditions'][$index]['label'] ?? null;
    }

    public function test_no_label_is_baked_for_a_paired_condition_in_any_mode(): void
    {
        foreach ([null, ['mode' => 'fixed', 'locale' => 'en'], ['mode' => 'fixed', 'locale' => 'pt']] as $language) {
            $baker = new PopupTextBaker($language, self::LOCALES);

            $this->assertNull(
                $this->label($baker->withFieldLabels($this->paired())),
                'a baked label would relabel the email box'
            );
        }
    }

    public function test_a_merchant_typed_label_is_still_left_alone(): void
    {
        $baker = new PopupTextBaker(['mode' => 'fixed', 'locale' => 'en'], self::LOCALES);

        $this->assertSame(
            'Your registered email',
            $this->label($baker->withFieldLabels($this->paired(['label' => 'Your registered email'])))
        );
    }

    public function test_every_other_input_type_still_bakes(): void
    {
        $baker = new PopupTextBaker(['mode' => 'fixed', 'locale' => 'en'], self::LOCALES);
        $conditions = [[
            'operator' => 'AND',
            'conditions' => [
                ['type' => 'emailFromList', 'value' => 'a@x.com'],
                ['type' => 'singlePasscode', 'value' => '1'],
            ],
        ]];

        $out = $baker->withFieldLabels($conditions);

        $this->assertSame('Email Address', $this->label($out, 0));
        $this->assertSame('Enter Passcode', $this->label($out, 1));
    }

    public function test_a_paired_condition_does_not_disturb_a_neighbour(): void
    {
        // Skipping it must not make the neighbour think there are two passcode
        // fields and number them "Passcode 1" / "Passcode 2".
        $baker = new PopupTextBaker(['mode' => 'fixed', 'locale' => 'en'], self::LOCALES);
        $conditions = [[
            'operator' => 'AND',
            'conditions' => [
                ['type' => 'pairedCredentials', 'value' => 'a@x.com,A1'],
                ['type' => 'singlePasscode', 'value' => '1'],
            ],
        ]];

        $out = $baker->withFieldLabels($conditions);

        $this->assertNull($this->label($out, 0));
        $this->assertSame('Enter Passcode', $this->label($out, 1));
    }
}
