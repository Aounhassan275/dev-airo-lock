<?php

namespace App\Jobs;

use App\Models\AccessRule;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Time-limited revoke for the Shopify Flow `airo-lock-grant-access`
 * action. When that action is invoked with `duration_hours > 0`, the
 * controller dispatches this job with a delay; on execution it removes
 * the tag(s) that were applied so the customer falls back outside the
 * rule's tag conditions.
 *
 * Tag resolution mirrors FlowController::revokeAccess so the same shape
 * of tags (conditions tags + synthetic per-rule tag) is removed. If the
 * rule has been deleted between grant and revoke, only the synthetic
 * per-rule tag is removed.
 */
class RevokeFlowGrantJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 60;

    public function __construct(
        public int $shopId,
        public int $customerId,
        public int $ruleId,
    ) {
    }

    public function handle(): void
    {
        $shop = User::find($this->shopId);
        if (!$shop) {
            Log::warning('RevokeFlowGrantJob: shop not found', ['shop_id' => $this->shopId]);
            return;
        }

        $rule = AccessRule::where('id', $this->ruleId)->where('shop_id', $shop->id)->first();

        $tags = $rule ? $this->extractTagsFromConditions($rule->conditions ?? []) : [];
        $tags[] = 'airo-lock-rule-' . $this->ruleId;
        $tags = array_values(array_unique($tags));

        foreach ($tags as $tag) {
            $this->removeCustomerTag($shop, $this->customerId, $tag);
        }
    }

    private function extractTagsFromConditions(array $conditions): array
    {
        $tags = [];
        foreach ($conditions as $group) {
            foreach (($group['conditions'] ?? []) as $cond) {
                if (($cond['type'] ?? null) === 'tag' && !empty($cond['value'])) {
                    $tags[] = $cond['value'];
                }
            }
        }
        return array_values(array_unique($tags));
    }

    private function removeCustomerTag($shop, int $customerId, string $tag): void
    {
        try {
            $gid = 'gid://shopify/Customer/' . $customerId;
            $mutation = <<<'GQL'
                mutation TagsRemove($id: ID!, $tags: [String!]!) {
                  tagsRemove(id: $id, tags: $tags) {
                    userErrors { field message }
                  }
                }
                GQL;
            $shop->api()->graph($mutation, ['id' => $gid, 'tags' => [$tag]]);
        } catch (\Throwable $e) {
            Log::warning('RevokeFlowGrantJob: tagsRemove failed', [
                'customer_id' => $customerId,
                'tag' => $tag,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
