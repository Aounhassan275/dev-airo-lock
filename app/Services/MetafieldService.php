<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class MetafieldService
{
    /**
     * Transport-level failure check. The gnikyt Graph client reports HTTP
     * 429/4xx/5xx as ['errors' => true, ...] with NO body.errors offset —
     * checking only body.errors used to classify those as SUCCESS, so a
     * throttled/failed write logged "set successfully" having written nothing.
     */
    private function transportError($response): ?array
    {
        if (!empty($response['errors'])) {
            $detail = $response['body'] ?? null;
            $detail = is_object($detail) ? json_decode(json_encode($detail), true) : $detail;

            return [
                'success' => false,
                'error' => 'Shopify API request failed (HTTP ' . ($response['status'] ?? 'unknown') . ')',
                'errors' => $detail,
            ];
        }

        return null;
    }

    /**
     * Set (create or update) a metafield using GraphQL Admin API
     *
     * @param object $shop - Shop instance with api() method
     * @param string $resourceGid - Full GID (e.g., gid://shopify/Product/123456)
     * @param string $namespace - Metafield namespace
     * @param string $key - Metafield key
     * @param mixed $value - Metafield value (will be JSON encoded if array/object)
     * @param string $type - Metafield type (default: 'json')
     * @return array - Response with success status and data
     */
    public function setMetafield($shop, $resourceGid, $namespace, $key, $value, $type = 'json')
    {
        try {
            // Prepare value based on type
            $metafieldValue = $type === 'json' ? json_encode($value) : $value;

            $mutation = <<<'GQL'
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields {
                        id
                        namespace
                        key
                        value
                        type
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL;

            $variables = [
                'metafields' => [
                    [
                        'ownerId' => $resourceGid,
                        'namespace' => $namespace,
                        'key' => $key,
                        'value' => $metafieldValue,
                        'type' => $type,
                    ]
                ]
            ];

            // Storefront enforcement depends on this write landing — retry
            // through throttling instead of failing the merchant's save.
            $response = ShopifyRetry::run(fn () => $shop->api()->graph($mutation, $variables));

            if ($transportError = $this->transportError($response)) {
                Log::error('Metafield set failed at HTTP level', [
                    'resource_gid' => $resourceGid,
                    'status' => $response['status'] ?? null,
                ]);
                return $transportError;
            }

            // Check for errors
            if (isset($response['body']['errors'])) {
                Log::error('GraphQL metafield set errors', [
                    'errors' => $response['body']['errors'],
                    'resource_gid' => $resourceGid
                ]);
                return [
                    'success' => false,
                    'errors' => $response['body']['errors']
                ];
            }

            $data = $response['body']['data']['metafieldsSet'] ?? null;

            // Convert userErrors to array if it's a ResponseAccess object
            $userErrors = $data['userErrors'] ?? [];
            if (is_object($userErrors)) {
                $userErrors = json_decode(json_encode($userErrors), true);
            }

            if (!empty($userErrors) && count($userErrors) > 0) {
                Log::error('GraphQL metafield set user errors', [
                    'userErrors' => $userErrors,
                    'resource_gid' => $resourceGid
                ]);
                return [
                    'success' => false,
                    'errors' => $userErrors
                ];
            }

            Log::info('Metafield set successfully via GraphQL', [
                'resource_gid' => $resourceGid,
                'namespace' => $namespace,
                'key' => $key,
                'metafield_id' => $data['metafields'][0]['id'] ?? null
            ]);

            return [
                'success' => true,
                'metafield' => $data['metafields'][0] ?? null
            ];
        } catch (\Exception $e) {
            Log::error('Exception in setMetafield', [
                'error' => $e->getMessage(),
                'resource_gid' => $resourceGid,
                'trace' => $e->getTraceAsString()
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get metafields for a resource using GraphQL Admin API
     *
     * @param object $shop - Shop instance with api() method
     * @param string $resourceGid - Full GID (e.g., gid://shopify/Product/123456)
     * @param string $namespace - Metafield namespace
     * @param string|null $key - Optional specific metafield key
     * @return array - Response with success status and metafields
     */
    public function getMetafields($shop, $resourceGid, $namespace, $key = null)
    {
        try {
            $query = <<<'GQL'
            query getMetafields($id: ID!, $namespace: String!) {
                node(id: $id) {
                    ... on Product {
                        metafields(first: 10, namespace: $namespace) {
                            edges {
                                node {
                                    id
                                    namespace
                                    key
                                    value
                                    type
                                }
                            }
                        }
                    }
                    ... on Collection {
                        metafields(first: 10, namespace: $namespace) {
                            edges {
                                node {
                                    id
                                    namespace
                                    key
                                    value
                                    type
                                }
                            }
                        }
                    }
                    ... on Page {
                        metafields(first: 10, namespace: $namespace) {
                            edges {
                                node {
                                    id
                                    namespace
                                    key
                                    value
                                    type
                                }
                            }
                        }
                    }
                    ... on Blog {
                        metafields(first: 10, namespace: $namespace) {
                            edges {
                                node {
                                    id
                                    namespace
                                    key
                                    value
                                    type
                                }
                            }
                        }
                    }
                }
            }
            GQL;

            // Shop metafields can't be read through node() — without this
            // branch, shop-wide locks read back empty and the read-modify-write
            // in updateMetafieldArray clobbers every other lock on the shop.
            if (str_contains($resourceGid, 'gid://shopify/Shop/')) {
                $query = <<<'GQL'
                query getShopMetafields($namespace: String!) {
                    shop {
                        metafields(first: 10, namespace: $namespace) {
                            edges {
                                node {
                                    id
                                    namespace
                                    key
                                    value
                                    type
                                }
                            }
                        }
                    }
                }
                GQL;

                $response = ShopifyRetry::run(fn () => $shop->api()->graph($query, ['namespace' => $namespace]));

                if ($transportError = $this->transportError($response)) {
                    return $transportError;
                }

                if (isset($response['body']['errors'])) {
                    Log::error('GraphQL shop metafield get errors', [
                        'errors' => $response['body']['errors'],
                        'resource_gid' => $resourceGid
                    ]);
                    return [
                        'success' => false,
                        'errors' => $response['body']['errors']
                    ];
                }

                $shopNode = $response['body']['data']['shop'] ?? null;
                $metafields = [];
                if ($shopNode && isset($shopNode['metafields']['edges'])) {
                    foreach ($shopNode['metafields']['edges'] as $edge) {
                        $metafield = $edge['node'];
                        if ($key === null || $metafield['key'] === $key) {
                            $metafields[] = $metafield;
                        }
                    }
                }

                return [
                    'success' => true,
                    'metafields' => $metafields
                ];
            }

            $variables = [
                'id' => $resourceGid,
                'namespace' => $namespace
            ];

            $response = ShopifyRetry::run(fn () => $shop->api()->graph($query, $variables));

            if ($transportError = $this->transportError($response)) {
                return $transportError;
            }

            if (isset($response['body']['errors'])) {
                Log::error('GraphQL metafield get errors', [
                    'errors' => $response['body']['errors'],
                    'resource_gid' => $resourceGid
                ]);
                return [
                    'success' => false,
                    'errors' => $response['body']['errors']
                ];
            }

            $node = $response['body']['data']['node'] ?? null;
            $metafields = [];

            if ($node && isset($node['metafields']['edges'])) {
                foreach ($node['metafields']['edges'] as $edge) {
                    $metafield = $edge['node'];
                    // Filter by key if specified
                    if ($key === null || $metafield['key'] === $key) {
                        $metafields[] = $metafield;
                    }
                }
            }

            return [
                'success' => true,
                'metafields' => $metafields
            ];
        } catch (\Exception $e) {
            Log::error('Exception in getMetafields', [
                'error' => $e->getMessage(),
                'resource_gid' => $resourceGid
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Delete a metafield using GraphQL Admin API
     *
     * @param object $shop - Shop instance with api() method
     * @param string $ownerId - Owner GID (e.g., gid://shopify/Product/123456)
     * @param string $namespace - Metafield namespace
     * @param string $key - Metafield key
     * @return array - Response with success status
     */
    public function deleteMetafield($shop, $ownerId, $namespace, $key)
    {
        try {
            // Shopify uses metafieldsDelete mutation with ownerId, namespace, and key
            $mutation = <<<'GQL'
            mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                metafieldsDelete(metafields: $metafields) {
                    deletedMetafields {
                        ownerId
                        namespace
                        key
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
            GQL;

            $variables = [
                'metafields' => [
                    [
                        'ownerId' => $ownerId,
                        'namespace' => $namespace,
                        'key' => $key
                    ]
                ]
            ];

            $response = ShopifyRetry::run(fn () => $shop->api()->graph($mutation, $variables));

            if ($transportError = $this->transportError($response)) {
                Log::error('Metafield delete failed at HTTP level', [
                    'owner_id' => $ownerId,
                    'status' => $response['status'] ?? null,
                ]);
                return $transportError;
            }

            // Log full response for debugging
            Log::info('GraphQL metafieldsDelete full response', [
                'response_body' => $response['body'] ?? null,
                'owner_id' => $ownerId
            ]);

            if (isset($response['body']['errors'])) {
                Log::error('GraphQL metafield delete errors', [
                    'errors' => $response['body']['errors'],
                    'owner_id' => $ownerId,
                    'namespace' => $namespace,
                    'key' => $key
                ]);
                return [
                    'success' => false,
                    'errors' => $response['body']['errors']
                ];
            }

            $data = $response['body']['data']['metafieldsDelete'] ?? null;

            // Convert userErrors to array if it's a ResponseAccess object
            $userErrors = $data['userErrors'] ?? [];
            if (is_object($userErrors)) {
                $userErrors = json_decode(json_encode($userErrors), true);
            }

            if (!empty($userErrors) && count($userErrors) > 0) {
                Log::error('GraphQL metafield delete user errors', [
                    'userErrors' => $userErrors,
                    'owner_id' => $ownerId,
                    'namespace' => $namespace,
                    'key' => $key
                ]);
                return [
                    'success' => false,
                    'errors' => $userErrors
                ];
            }

            Log::info('Metafield deleted successfully via GraphQL', [
                'deleted_metafields' => $data['deletedMetafields'] ?? null
            ]);

            return [
                'success' => true,
                'deleted_metafields' => $data['deletedMetafields'] ?? null
            ];
        } catch (\Exception $e) {
            Log::error('Exception in deleteMetafield', [
                'error' => $e->getMessage(),
                'owner_id' => $ownerId,
                'namespace' => $namespace,
                'key' => $key
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Get the current value of a metafield
     *
     * @param object $shop - Shop instance with api() method
     * @param string $resourceGid - Full GID
     * @param string $namespace - Metafield namespace
     * @param string $key - Metafield key
     * @return array - Response with success status and value
     */
    public function getMetafieldValue($shop, $resourceGid, $namespace, $key)
    {
        $result = $this->getMetafields($shop, $resourceGid, $namespace, $key);

        if (!$result['success']) {
            return $result;
        }

        $metafields = $result['metafields'] ?? [];

        if (empty($metafields)) {
            return [
                'success' => true,
                'value' => null,
                'exists' => false
            ];
        }

        $metafield = $metafields[0];
        $value = $metafield['value'] ?? null;

        // Parse JSON if type is json
        if ($metafield['type'] === 'json' && $value) {
            $value = json_decode($value, true);
        }

        return [
            'success' => true,
            'value' => $value,
            'exists' => true,
            'metafield_id' => $metafield['id'] ?? null
        ];
    }

    /**
     * Update a metafield that stores an array of locks
     * Adds or updates a specific lock's data without overwriting others
     *
     * @param object $shop - Shop instance
     * @param string $resourceGid - Full GID
     * @param string $namespace - Metafield namespace
     * @param string $key - Metafield key
     * @param int $lockId - Lock ID to add/update
     * @param array $lockData - Lock data to store
     * @return array - Response with success status
     */
    public function updateMetafieldArray($shop, $resourceGid, $namespace, $key, $lockId, $lockData)
    {
        try {
            // Get current metafield value
            $currentResult = $this->getMetafieldValue($shop, $resourceGid, $namespace, $key);

            if (!$currentResult['success']) {
                return $currentResult;
            }

            $currentValue = $currentResult['value'] ?? null;
            $locks = [];

            // Parse existing data
            if ($currentValue) {
                // Check if it's already an array format
                if (isset($currentValue['locks']) && is_array($currentValue['locks'])) {
                    $locks = $currentValue['locks'];
                } else {
                    // Legacy single-lock format - convert to array
                    // Only if it has a lock_id or rule_id
                    if (isset($currentValue['lock_id']) || isset($currentValue['rule_id'])) {
                        $locks = [$currentValue];
                    }
                }
            }

            // Find and update or add the lock
            $found = false;
            foreach ($locks as $index => $lock) {
                if (isset($lock['lock_id']) && $lock['lock_id'] == $lockId) {
                    $locks[$index] = $lockData;
                    $found = true;
                    break;
                }

                if (
                    !$found &&
                    !isset($lock['lock_id']) &&
                    isset($lock['rule_id'], $lockData['rule_id']) &&
                    $lock['rule_id'] == $lockData['rule_id']
                ) {
                    $locks[$index] = $lockData;
                    $found = true;
                    break;
                }
            }

            if (!$found) {
                $locks[] = $lockData;
            }

            // Wrap in locks array
            $newValue = ['locks' => $locks];

            // Write back to metafield
            return $this->setMetafield($shop, $resourceGid, $namespace, $key, $newValue);
        } catch (\Exception $e) {
            Log::error('Exception in updateMetafieldArray', [
                'error' => $e->getMessage(),
                'resource_gid' => $resourceGid,
                'lock_id' => $lockId
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Remove a specific lock from a metafield array
     *
     * @param object $shop - Shop instance
     * @param string $resourceGid - Full GID
     * @param string $namespace - Metafield namespace
     * @param string $key - Metafield key
     * @param int $lockId - Lock ID to remove
     * @return array - Response with success status
     */
    public function removeFromMetafieldArray($shop, $resourceGid, $namespace, $key, $lockId, $ruleIds = [])
    {
        try {
            // Get current metafield value
            $currentResult = $this->getMetafieldValue($shop, $resourceGid, $namespace, $key);

            if (!$currentResult['success']) {
                return $currentResult;
            }

            if (!$currentResult['exists']) {
                // Metafield doesn't exist, nothing to remove
                Log::info('Metafield array remove: metafield does not exist', [
                    'resource_gid' => $resourceGid,
                    'namespace' => $namespace,
                    'key' => $key,
                    'lock_id' => $lockId,
                    'rule_ids' => $ruleIds,
                ]);
                return ['success' => true, 'message' => 'Metafield does not exist'];
            }

            $currentValue = $currentResult['value'] ?? null;
            $locks = [];

            // Parse existing data
            if ($currentValue) {
                if (isset($currentValue['locks']) && is_array($currentValue['locks'])) {
                    $locks = $currentValue['locks'];
                } else {
                    // Legacy single-lock format
                    if (isset($currentValue['lock_id']) || isset($currentValue['rule_id'])) {
                        $locks = [$currentValue];
                    }
                }
            }

            $beforeCount = count($locks);

            // Remove the specific lock
            $ruleIds = is_array($ruleIds) ? array_values(array_filter($ruleIds)) : [];

            $locks = array_filter($locks, function ($lock) use ($lockId, $ruleIds) {
                // Primary removal: match lock_id
                if (isset($lock['lock_id']) && (string) $lock['lock_id'] === (string) $lockId) {
                    return false;
                }

                // Legacy removal: some historical entries stored only rule_id (no lock_id)
                if (!empty($ruleIds) && !isset($lock['lock_id']) && isset($lock['rule_id'])) {
                    return !in_array((string) $lock['rule_id'], array_map('strval', $ruleIds), true);
                }

                return true;
            });

            // Re-index array
            $locks = array_values($locks);
            $afterCount = count($locks);

            Log::info('Metafield array remove: filtered locks', [
                'resource_gid' => $resourceGid,
                'namespace' => $namespace,
                'key' => $key,
                'lock_id' => $lockId,
                'rule_ids' => $ruleIds,
                'before_count' => $beforeCount,
                'after_count' => $afterCount,
            ]);

            // If no locks remain, delete the metafield
            if (empty($locks)) {
                Log::info('Metafield array remove: deleting metafield (no locks remain)', [
                    'resource_gid' => $resourceGid,
                    'namespace' => $namespace,
                    'key' => $key,
                    'lock_id' => $lockId,
                ]);
                return $this->deleteMetafield($shop, $resourceGid, $namespace, $key);
            }

            // Otherwise, update with remaining locks
            $newValue = ['locks' => $locks];
            Log::info('Metafield array remove: updating metafield with remaining locks', [
                'resource_gid' => $resourceGid,
                'namespace' => $namespace,
                'key' => $key,
                'remaining_count' => count($locks),
            ]);
            return $this->setMetafield($shop, $resourceGid, $namespace, $key, $newValue);
        } catch (\Exception $e) {
            Log::error('Exception in removeFromMetafieldArray', [
                'error' => $e->getMessage(),
                'resource_gid' => $resourceGid,
                'lock_id' => $lockId
            ]);
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Build a Shopify GID from resource type and numeric ID
     *
     * @param string $resourceType - Resource type (e.g., 'products', 'collections', 'pages', 'blogs')
     * @param string|int $numericId - Numeric ID
     * @return string - Full GID
     */
    public function buildResourceGid($resourceType, $numericId)
    {
        // Map plural resource names to singular GraphQL types
        $typeMap = [
            'products' => 'Product',
            'collections' => 'Collection',
            'pages' => 'Page',
            'blogs' => 'Blog',
            'shops' => 'Shop',
        ];

        $graphqlType = $typeMap[$resourceType] ?? ucfirst(rtrim($resourceType, 's'));

        // Tolerate an already-formed GID. Some store rows persist
        // shopify_store_id as a full 'gid://shopify/Shop/NNN' rather than the
        // bare numeric id; without this the prefix is applied twice and
        // Shopify rejects the write with "Invalid global id
        // 'gid://shopify/Shop/gid://shopify/Shop/NNN'" — which broke every
        // shop-level and checkout metafield write for those shops.
        if (is_string($numericId) && str_starts_with($numericId, 'gid://')) {
            $numericId = preg_replace('#^gid://shopify/[^/]+/#', '', $numericId);
        }

        return "gid://shopify/{$graphqlType}/{$numericId}";
    }
}
