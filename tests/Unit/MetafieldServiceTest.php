<?php

namespace Tests\Unit;

use App\Services\MetafieldService;
use PHPUnit\Framework\TestCase;

class MetafieldServiceTest extends TestCase
{
    private MetafieldService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new MetafieldService();
    }

    public function test_builds_a_gid_from_a_bare_numeric_id(): void
    {
        $this->assertSame(
            'gid://shopify/Shop/84662976768',
            $this->service->buildResourceGid('shops', '84662976768')
        );
        $this->assertSame(
            'gid://shopify/Product/123',
            $this->service->buildResourceGid('products', 123)
        );
    }

    public function test_does_not_double_prefix_an_already_formed_gid(): void
    {
        // Regression: some store rows persist shopify_store_id as a full GID,
        // which produced 'gid://shopify/Shop/gid://shopify/Shop/NNN' and broke
        // every shop-level and checkout metafield write for those shops.
        $this->assertSame(
            'gid://shopify/Shop/84662976768',
            $this->service->buildResourceGid('shops', 'gid://shopify/Shop/84662976768')
        );
    }

    public function test_normalises_a_gid_of_a_different_type_to_the_requested_type(): void
    {
        // A stored GID's numeric id is reused under the requested resource type.
        $this->assertSame(
            'gid://shopify/Shop/999',
            $this->service->buildResourceGid('shops', 'gid://shopify/SomethingElse/999')
        );
    }
}
