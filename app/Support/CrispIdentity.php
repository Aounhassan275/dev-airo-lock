<?php

namespace App\Support;

use App\Models\CrispSession;
use Illuminate\Support\Str;
use Osiset\ShopifyApp\Contracts\ShopModel;
use Osiset\ShopifyApp\Objects\Values\SessionToken;

/**
 * The Crisp session token (CRISP_TOKEN_ID) for whoever is logged into the
 * Shopify admin looking at the embedded app.
 *
 * Why a token at all: the app renders inside the Shopify admin iframe, so the
 * session id Crisp normally keeps in the browser is third-party storage and
 * browsers drop it between visits — the merchant comes back and support gets a
 * brand new conversation with none of the history. A token we supply on every
 * page load makes Crisp restore the same conversation instead, on any browser
 * or device.
 *
 * Why it is keyed on the admin user and not the shop: a store's admin is not
 * only the merchant. Staff accounts, agencies, freelancers and our own
 * collaborator access all open the same app. One token per shop would let any
 * of them resume — and read — the merchant's support conversation. The session
 * token's `sub` claim is the Shopify user id of whoever is signed in, so each
 * person gets their own thread, and the merchant's stays continuous across
 * their devices (`sub` is the same everywhere they sign in).
 *
 * Note that the session token itself is short-lived and a different string on
 * every call — only the `sub` inside it is stable. Which is also why an IP or a
 * browser fingerprint is the wrong key: it changes under one person (mobile
 * data, VPN, ISP lease) and is shared between people (one office, one public
 * IP), so it would both lose sessions and leak them.
 *
 * Crisp requires the token to be unguessable — anyone holding it can read the
 * whole conversation — so it is a random UUID v4 stored server-side.
 */
final class CrispIdentity
{
    /**
     * @param  ShopModel  $shop  The signed-in shop (your app's shop model).
     * @param  string  $sessionToken  Shopify session token (App Bridge `idToken()`).
     * @return string|null  Null when the token doesn't check out — the chatbox
     *                      then loads untokenised rather than risk handing
     *                      someone the wrong conversation.
     */
    public static function tokenFor(ShopModel $shop, string $sessionToken): ?string
    {
        $staffUserId = self::staffUserId($shop, $sessionToken);
        if ($staffUserId === null) {
            return null;
        }

        return CrispSession::firstOrCreate(
            ['user_id' => $shop->getKey(), 'shopify_user_id' => $staffUserId],
            ['token' => (string) Str::uuid()],
        )->token;
    }

    /**
     * Shopify user id of the signed-in admin user, from the verified session
     * token.
     */
    private static function staffUserId(ShopModel $shop, string $sessionToken): ?string
    {
        if ($sessionToken === '') {
            return null;
        }

        try {
            // Verifies the signature, audience and expiry against this app's
            // API secret; throws on anything it doesn't like.
            $token = new SessionToken($sessionToken);
        } catch (\Throwable $e) {
            return null;
        }

        // And it has to be a token for the shop we are answering for.
        if (strcasecmp($token->getShopDomain()->toNative(), $shop->getDomain()->toNative()) !== 0) {
            return null;
        }

        return $token->getSubject() ?: null;
    }
}
