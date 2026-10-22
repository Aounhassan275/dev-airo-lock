<?php

namespace Tests\Unit;

use App\Services\PopupTextBaker;
use App\Services\PopupTextOverrides;
use PHPUnit\Framework\TestCase;

/**
 * Per-lock popup wording.
 *
 * These run the two services in the order buildRuleMetafieldData() uses them —
 * overrides first, then the baker — because that order IS the feature: the
 * baker only fills blanks, so applying an override first makes it look
 * merchant-authored and survive. Reverse them and every override is lost.
 *
 *     lock override  >  widget value  >  translated default
 */
class PopupTextOverridesTest extends TestCase
{
    private const LOCALES = ['en', 'pt-PT'];

    /** @return array{0: array<string, mixed>, 1: array<int, array<string, mixed>>} */
    private function pipeline(?array $popupText, array $widget, array $conditions, ?array $language = ['mode' => 'fixed', 'locale' => 'en']): array
    {
        $overrides = new PopupTextOverrides($popupText);
        if (! $overrides->isEmpty()) {
            $widget = $overrides->withWidgetText($widget);
            $conditions = $overrides->withFieldLabels($conditions);
        }

        $baker = new PopupTextBaker($language, self::LOCALES);
        if (! $baker->isNoop()) {
            $widget = $baker->withWidgetText($widget);
            $conditions = $baker->withFieldLabels($conditions);
        }

        return [$widget['settings']['designOptions'], $conditions];
    }

    private function blankWidget(): array
    {
        return ['settings' => ['designOptions' => [
            'headerSettings' => ['text' => ''],
            'layout' => ['buttonText' => ''],
            'placeholderText' => '',
            'emailPlaceholderText' => '',
        ]]];
    }

    private function conditions(): array
    {
        return [['operator' => 'AND', 'conditions' => [
            ['type' => 'multiplePasscodes', 'value' => '1'],
            ['type' => 'emailFromList', 'value' => 'a@x.com'],
        ]]];
    }

    public function test_without_overrides_the_translated_defaults_still_win(): void
    {
        [$design, $conditions] = $this->pipeline(null, $this->blankWidget(), $this->conditions());

        $this->assertSame('🔒 Access Required', $design['headerSettings']['text']);
        $this->assertSame('Submit', $design['layout']['buttonText']);
        $this->assertSame('Enter Passcode', $conditions[0]['conditions'][0]['label']);
        $this->assertSame('Email Address', $conditions[0]['conditions'][1]['label']);
    }

    public function test_a_lock_override_beats_the_translated_default(): void
    {
        [$design, $conditions] = $this->pipeline([
            'header' => 'VIP Early Access',
            'button' => 'Unlock',
            'passcode_label' => 'Your invite code',
            'passcode_placeholder' => 'e.g. VIP-0001',
            'email_label' => 'Your email',
            'email_placeholder' => 'you@company.com',
        ], $this->blankWidget(), $this->conditions());

        $this->assertSame('VIP Early Access', $design['headerSettings']['text']);
        $this->assertSame('Unlock', $design['layout']['buttonText']);
        $this->assertSame('e.g. VIP-0001', $design['placeholderText']);
        $this->assertSame('you@company.com', $design['emailPlaceholderText']);
        $this->assertSame('Your invite code', $conditions[0]['conditions'][0]['label']);
        $this->assertSame('Your email', $conditions[0]['conditions'][1]['label']);
    }

    public function test_a_lock_override_beats_a_widget_value_and_leaves_the_rest_alone(): void
    {
        $styled = ['settings' => ['designOptions' => [
            'headerSettings' => ['text' => 'Members only'],
            'layout' => ['buttonText' => 'Go'],
        ]]];

        [$design] = $this->pipeline(['header' => 'VIP Early Access'], $styled, $this->conditions());

        $this->assertSame('VIP Early Access', $design['headerSettings']['text']);
        $this->assertSame('Go', $design['layout']['buttonText'], 'an untouched field keeps the widget wording');
    }

    public function test_a_blank_override_is_not_an_override(): void
    {
        $styled = ['settings' => ['designOptions' => [
            'headerSettings' => ['text' => 'Members only'],
            'layout' => ['buttonText' => 'Go'],
        ]]];

        [$design] = $this->pipeline(['header' => '', 'button' => '   '], $styled, $this->conditions());

        $this->assertSame('Members only', $design['headerSettings']['text']);
        $this->assertSame('Go', $design['layout']['buttonText']);
    }

    public function test_a_label_typed_on_the_condition_beats_the_lock_wide_override(): void
    {
        $typed = [['operator' => 'AND', 'conditions' => [
            ['type' => 'multiplePasscodes', 'value' => '1', 'label' => 'Dealer code'],
        ]]];

        [, $conditions] = $this->pipeline(['passcode_label' => 'Your invite code'], $this->blankWidget(), $typed);

        $this->assertSame('Dealer code', $conditions[0]['conditions'][0]['label']);
    }

    public function test_overrides_apply_even_when_the_baker_does_nothing(): void
    {
        // A single-English store with no translation overrides makes the baker
        // a no-op, and the override must not be skipped along with it.
        $overrides = new PopupTextOverrides(['header' => 'VIP Early Access']);
        $widget = $overrides->withWidgetText($this->blankWidget());

        $this->assertSame('VIP Early Access', $widget['settings']['designOptions']['headerSettings']['text']);
    }

    public function test_paired_credentials_take_the_email_label(): void
    {
        // The popup applies a condition's label to its FIRST field, which for
        // this type is the email box; its passcode box keeps the default.
        $paired = [['operator' => 'AND', 'conditions' => [
            ['type' => 'pairedCredentials', 'value' => 'a@x.com,A1'],
        ]]];

        [, $conditions] = $this->pipeline(
            ['email_label' => 'Your email', 'passcode_label' => 'Your invite code'],
            $this->blankWidget(),
            $paired
        );

        $this->assertSame('Your email', $conditions[0]['conditions'][0]['label']);
    }

    public function test_sanitize_strips_blanks_and_unknown_keys(): void
    {
        $this->assertSame(
            ['header' => 'Hi'],
            PopupTextOverrides::sanitize([
                'header' => '  Hi  ',
                'button' => '',
                'email_label' => null,
                'nonsense' => 'dropped',
            ])
        );
        $this->assertSame([], PopupTextOverrides::sanitize(null));
    }

    public function test_a_null_widget_is_left_null(): void
    {
        // A lock with no widget selected still has to survive the overlay.
        $this->assertNull((new PopupTextOverrides(['header' => 'Hi']))->withWidgetText(null));
    }
}
