<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * Exponential backoff with jitter for Shopify Admin API calls (BFS 5.9).
 *
 * Shopify's BFS guidance asks apps to retry rate-limited / transient
 * errors with backoff rather than failing or hot-looping. Use this
 * helper to wrap GraphQL / REST calls that can fail under throttling:
 *
 *     $result = ShopifyRetry::run(fn() => $shop->api()->graph($q, $vars));
 *
 * The callable is invoked up to $maxAttempts times. On THROTTLED errors
 * or HTTP 429, we wait base * 2^attempt + random jitter (capped at $maxDelayMs)
 * before retrying.
 */
class ShopifyRetry
{
    public static function run(
        callable $operation,
        int $maxAttempts = 4,
        int $baseDelayMs = 250,
        int $maxDelayMs = 4000
    ) {
        $attempt = 0;

        while (true) {
            $attempt++;
            try {
                $result = $operation();

                if (self::isThrottled($result) && $attempt < $maxAttempts) {
                    $delay = self::computeDelay($attempt, $baseDelayMs, $maxDelayMs);
                    Log::info('Shopify throttled, retrying', [
                        'attempt' => $attempt,
                        'delay_ms' => $delay,
                    ]);
                    usleep($delay * 1000);
                    continue;
                }

                return $result;
            } catch (\Throwable $e) {
                if ($attempt >= $maxAttempts) {
                    throw $e;
                }
                if (!self::isRetryableException($e)) {
                    throw $e;
                }
                $delay = self::computeDelay($attempt, $baseDelayMs, $maxDelayMs);
                Log::info('Shopify transient error, retrying', [
                    'attempt' => $attempt,
                    'delay_ms' => $delay,
                    'error' => $e->getMessage(),
                ]);
                usleep($delay * 1000);
            }
        }
    }

    /**
     * Detect Shopify's throttled / cost-exceeded responses across both
     * the kyon147 package's array result and a raw HTTP shape.
     */
    private static function isThrottled($result): bool
    {
        if (!is_array($result)) {
            return false;
        }
        $status = $result['status'] ?? null;
        if ($status === 429) {
            return true;
        }
        $errors = $result['body']['errors'] ?? [];
        if (is_array($errors)) {
            foreach ($errors as $err) {
                $code = $err['extensions']['code'] ?? '';
                if (in_array($code, ['THROTTLED', 'MAX_COST_EXCEEDED'], true)) {
                    return true;
                }
            }
        }
        return false;
    }

    private static function isRetryableException(\Throwable $e): bool
    {
        // Network blips and timeouts are retryable; logic errors are not.
        $msg = strtolower($e->getMessage());
        return str_contains($msg, 'timeout')
            || str_contains($msg, 'connection')
            || str_contains($msg, 'curl error')
            || str_contains($msg, '429')
            || str_contains($msg, 'throttled');
    }

    private static function computeDelay(int $attempt, int $base, int $max): int
    {
        $exp = $base * (2 ** ($attempt - 1));
        $jitter = random_int(0, $base);
        return min($exp + $jitter, $max);
    }
}
