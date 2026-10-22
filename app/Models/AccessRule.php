<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccessRule extends Model
{
    protected $fillable = [
        'lock_id',
        'shop_id',
        'handle',
        'resource_type',
        'conditions',
        'prompt',
        'redirect_url',
        'enabled',
        'protect_products',
        'hide_navigation',
        'hide_lists',
        'force_open',
        'hide_price',
        'hide_add_to_cart',
        'price_message',
        'settings',
    ];

    protected $casts = [
        'conditions'       => 'array',
        'settings'         => 'array',
        'enabled'          => 'boolean',
        'protect_products' => 'boolean',
        'hide_navigation'  => 'boolean',
        'hide_lists'       => 'boolean',
        'force_open'       => 'boolean',
        'hide_price'       => 'boolean',
        'hide_add_to_cart'  => 'boolean',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shop_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(AccessLog::class);
    }

    public static function forResource($shopId, $resourceType, $handle)
    {
        return self::where('shop_id', $shopId)
            ->where('resource_type', $resourceType)
            ->where('handle', $handle)
            ->where('enabled', true)
            ->first();
    }

    public function checkAccess(array $customerData = []): bool
    {
        $conditions = $this->conditions ?? [];

        // If no conditions set, deny access by default (locked by default)
        if (empty($conditions)) {
            return false;
        }

        // Check each condition group (OR logic between groups)
        foreach ($conditions as $group) {
            if (!is_array($group)) {
                continue; // Skip invalid groups
            }
            if ($this->evaluateGroup($group, $customerData)) {
                return true;
            }
        }

        return false;
    }

    private function evaluateGroup(array $group, array $customerData): bool
    {
        $groupConditions = $group['conditions'] ?? [];
        $operator        = strtoupper($group['operator'] ?? 'AND');

        // Empty group grants access
        if (empty($groupConditions)) {
            return true;
        }

        $results = [];
        foreach ($groupConditions as $condition) {
            if (!is_array($condition)) {
                continue; // Skip invalid conditions
            }
            $results[] = $this->evaluateCondition($condition, $customerData);
        }

        // AND: all must be true
        // OR: at least one must be true
        return $operator === 'AND'
            ? !in_array(false, $results, true)
            : in_array(true, $results, true);
    }

    /**
     * Split a multi-value condition (passcode list, email allow-list) into its
     * values. Newline-joined is canonical; old admin builds showed a literal
     * '\n' in the field placeholder, so some saves are backslash-separated on
     * a single line. Mirrors splitListValue() in the storefront validator and
     * resources/js/lib/listValue.js — all three must agree or a value the
     * merchant can see in the admin silently fails to unlock.
     *
     * @return string[]
     */
    private static function splitListValue(string $value): array
    {
        $parts = str_contains($value, "\n")
            ? explode("\n", $value)
            : preg_split('/\\\\n|\\\\/', $value);

        return array_values(array_filter(array_map('trim', $parts), fn ($v) => $v !== ''));
    }

    /**
     * One stored `email,passcode` line → its two halves.
     *
     * The separator is the FIRST comma, semicolon, tab or colon: an email
     * address can contain none of them, so everything after it belongs to the
     * passcode and a code containing a comma survives. Mirrors parsePair() in
     * resources/js/lib/pairList.js and splitPair() in the storefront validator.
     *
     * @return array{email: string, passcode: string}
     */
    private static function splitPair(string $line): array
    {
        $text = trim($line);
        if (! preg_match('/[,;\t:]/', $text, $m, PREG_OFFSET_CAPTURE)) {
            return ['email' => strtolower($text), 'passcode' => ''];
        }

        $at = $m[0][1];

        return [
            'email' => strtolower(trim(substr($text, 0, $at))),
            'passcode' => trim(substr($text, $at + 1)),
        ];
    }

    private function evaluateCondition(array $condition, array $customerData): bool
    {
        $result = false;
        $type   = $condition['type'] ?? '';
        $value  = $condition['value'] ?? '';
        $invert = $condition['invert'] ?? false;

        switch ($type) {
            case 'singlePasscode':
            case 'passcode':
                $customerPasscode = $customerData['passcode'] ?? '';
                $result = !empty($customerPasscode) && trim($customerPasscode) === trim($value);
                break;

            case 'multiplePasscodes':
            case 'passcodeFromList':
                $passcodes = self::splitListValue($value);
                $customerPasscode = $customerData['passcode'] ?? '';
                $result = !empty($customerPasscode) && in_array(trim($customerPasscode), $passcodes, true);
                break;

            case 'tag':
                $customerTags = $customerData['tags'] ?? [];
                $result = in_array($value, (array) $customerTags, true);
                break;

            case 'signedIn':
                $loggedIn = (bool) ($customerData['logged_in'] ?? false);
                $result = ($value === 'loggedIn' && $loggedIn) || ($value === 'guest' && !$loggedIn);
                break;

            case 'emailContains':
                $email = strtolower($customerData['email'] ?? '');
                $result = !empty($email) && str_contains($email, strtolower($value));
                break;

            case 'specificEmail':
                $email = strtolower($customerData['email'] ?? '');
                $result = !empty($email) && $email === strtolower($value);
                break;

            case 'emailFromList':
                $email = strtolower(trim($customerData['email'] ?? ''));
                $allowed = array_map('strtolower', self::splitListValue($value));
                $result = !empty($email) && in_array($email, $allowed, true);
                break;

            // One passcode that only works for one address: both halves must
            // come from the SAME row. A code issued to someone else is worth
            // no more than no code at all — that is the whole point of the type.
            case 'pairedCredentials':
                $email = strtolower(trim($customerData['email'] ?? ''));
                $code = trim((string) ($customerData['passcode'] ?? ''));
                $result = false;
                if ($email !== '' && $code !== '') {
                    foreach (self::splitListValue($value) as $line) {
                        $pair = self::splitPair($line);
                        if ($pair['email'] === $email && $pair['passcode'] === $code) {
                            $result = true;
                            break;
                        }
                    }
                }
                break;

            case 'location':
                $country = strtoupper($customerData['country'] ?? '');
                if ($value === 'custom') {
                    $customValue = $condition['custom'] ?? '';
                    $result = !empty($country) && str_contains($country, strtoupper($customValue));
                } else {
                    $result = !empty($country) && $country === strtoupper($value);
                }
                break;

            case 'ip':
                $ipAddress = $customerData['ip_address'] ?? '';
                $result = !empty($ipAddress) && $ipAddress === $value;
                break;

            default:
                // Unknown condition type defaults to false
                $result = false;
                break;
        }

        return $invert ? !$result : $result;
    }
    public function lock(): BelongsTo
    {
        return $this->belongsTo(Lock::class);
    }
}
