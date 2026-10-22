import { router, usePage } from '@inertiajs/react';
import {
    Badge,
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Divider,
    Icon,
    InlineGrid,
    InlineStack,
    Layout,
    Page,
    Text,
} from '@shopify/polaris';
import {
    BlogIcon,
    CheckIcon,
    ClockIcon,
    CodeIcon,
    CollectionIcon,
    DesktopIcon,
    EmailIcon,
    GlobeIcon,
    HashtagIcon,
    KeyIcon,
    LinkIcon,
    LockIcon,
    PageIcon,
    PersonIcon,
    ProductIcon,
    StoreIcon,
} from '@shopify/polaris-icons';
import { lockKindLabel, resourceTypeLabel, resourceTypesFromRules } from '../lib/resourceTypes';
import { splitListValue } from '../lib/listValue';

// ─── Helpers ────────────────────────────────────────────────────────────────

const CONDITION_LABELS = {
    tag: 'Tagged customer',
    signedIn: 'Signed-in state',
    singlePasscode: 'Single passcode',
    multiplePasscodes: 'Multiple passcodes',
    singleSecretLink: 'Secret link',
    location: 'Location',
    specificEmail: 'Specific email',
    emailContains: 'Email contains',
    emailFromList: 'Email list',
    pairedCredentials: 'Email + passcode pairs',
    ip: 'IP address',
    ageVerification: 'Age verification',
};

const CONDITION_ICONS = {
    tag: HashtagIcon,
    signedIn: PersonIcon,
    singlePasscode: KeyIcon,
    multiplePasscodes: KeyIcon,
    singleSecretLink: LinkIcon,
    location: GlobeIcon,
    specificEmail: EmailIcon,
    emailContains: EmailIcon,
    emailFromList: EmailIcon,
    pairedCredentials: KeyIcon,
    ip: DesktopIcon,
    ageVerification: PersonIcon,
};

const RESOURCE_ICONS = {
    product: ProductIcon,
    collection: CollectionIcon,
    page: PageIcon,
    blog: BlogIcon,
    theme: CodeIcon,
    shop: StoreIcon,
};

function conditionValueLabel(cond) {
    if (!cond.type) return '—';
    if (cond.type === 'signedIn') return cond.value === 'guest' ? 'Guest visitors' : 'Logged-in customers';
    if (cond.type === 'ageVerification') return `${cond.value || 18}+ years old`;
    if (cond.type === 'location') {
        if (cond.value === 'custom') return cond.custom || 'Custom location';
        return cond.value || '—';
    }
    // A list condition can hold hundreds of values — summarise it as a count.
    // splitListValue also recognises legacy backslash-separated saves, keeping
    // these counts in line with what the storefront accepts.
    if (cond.type === 'pairedCredentials') {
        const pairs = splitListValue(cond.value || '').filter((s) => s.trim());
        return `${pairs.length} pair${pairs.length !== 1 ? 's' : ''}`;
    }
    if (cond.type === 'multiplePasscodes' || cond.type === 'emailFromList') {
        const noun = cond.type === 'emailFromList' ? 'email' : 'passcode';
        const lines = splitListValue(cond.value || '').filter((s) => s.trim());
        return `${lines.length} ${noun}${lines.length !== 1 ? 's' : ''}`;
    }
    return cond.value || '—';f
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ label, children }) {
    return (
        <InlineStack align="space-between" blockAlign="start" gap="400">
            <Text variant="bodySm" tone="subdued" as="span" minWidth="120px">
                {label}
            </Text>
            <Box>{children}</Box>
        </InlineStack>
    );
}

function ConditionCard({ cond, index }) {
    const CondIcon = CONDITION_ICONS[cond.type] || KeyIcon;
    const { store, auth } = usePage().props;

    // The storefront unlocks secret-link conditions via ?access=CODE — show
    // the composed link here so merchants can retrieve it after saving, not
    // only while editing. store.url holds the primary domain; the myshopify
    // domain (users.name) is the fallback.
    const storefrontBase =
        (store?.url || '').replace(/\/+$/, '') || (auth?.user?.name ? `https://${auth.user.name}` : '');
    const secretLink =
        cond.type === 'singleSecretLink' && (cond.value || '').trim() && storefrontBase
            ? `${storefrontBase}/?access=${encodeURIComponent(cond.value.trim())}`
            : '';

    return (
        <div
            style={{
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '12px 16px',
                background: '#fafafa',
            }}
        >
            <InlineStack gap="300" blockAlign="center">
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: '#ede9fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    <Icon source={CondIcon} tone="magic" />
                </div>
                <BlockStack gap="050">
                    <InlineStack gap="200" blockAlign="center">
                        <Text variant="bodySm" fontWeight="semibold" as="span">
                            {CONDITION_LABELS[cond.type] || cond.type}
                        </Text>
                        <Badge tone="info" size="small">
                            Condition {index + 1}
                        </Badge>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued" as="span">
                        {conditionValueLabel(cond)}
                    </Text>
                    {secretLink && (
                        <InlineStack gap="200" blockAlign="center" wrap={false}>
                            <Text variant="bodySm" as="span" breakWord>
                                {secretLink}
                            </Text>
                            <Button
                                size="micro"
                                onClick={() => navigator.clipboard?.writeText(secretLink)}
                            >
                                Copy
                            </Button>
                        </InlineStack>
                    )}
                </BlockStack>
            </InlineStack>
        </div>
    );
}

function RuleCard({ rule }) {
    let conditions = rule.conditions || [];
    if (typeof conditions === 'string') {
        try {
            conditions = JSON.parse(conditions);
        } catch {
            conditions = [];
        }
    }

    // Flatten if it's the nested-groups format [{operator, conditions:[…]}]
    const isGrouped =
        Array.isArray(conditions) &&
        conditions.length > 0 &&
        conditions[0] &&
        typeof conditions[0] === 'object' &&
        'conditions' in conditions[0];

    const groups = isGrouped ? conditions : [{ operator: 'AND', conditions }];

    const ResourceIcon = RESOURCE_ICONS[rule.resource_type] || ProductIcon;

    return (
        <Card padding="400">
            <BlockStack gap="300">
                {/* Resource header */}
                <InlineStack gap="300" blockAlign="center">
                    <div
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: '#f3f0ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Icon source={ResourceIcon} tone="magic" />
                    </div>
                    <BlockStack gap="050">
                        <Text variant="bodyMd" fontWeight="semibold" as="span">
                            {rule.title || rule.handle}
                        </Text>
                        <InlineStack gap="150">
                            <Text variant="bodySm" tone="subdued" as="span">
                                {rule.resource_type}
                            </Text>
                            {rule.handle && (
                                <Text variant="bodySm" tone="subdued" as="span">
                                    · {rule.handle}
                                </Text>
                            )}
                        </InlineStack>
                    </BlockStack>
                    <div style={{ marginLeft: 'auto' }}>
                        <Badge tone={rule.enabled ? 'success' : 'attention'}>
                            {rule.enabled ? 'Active' : 'Inactive'}
                        </Badge>
                    </div>
                </InlineStack>

                <Divider />

                {/* Conditions */}
                {groups.map((group, gi) => (
                    <BlockStack key={gi} gap="200">
                        {groups.length > 1 && (
                            <InlineStack gap="200" blockAlign="center">
                                <Text variant="bodySm" fontWeight="medium" tone="subdued" as="span">
                                    Group {gi + 1}
                                </Text>
                                <Badge>
                                    {group.operator === 'AND' ? 'All must match' : 'Any can match'}
                                </Badge>
                            </InlineStack>
                        )}
                        {(group.conditions || []).map((cond, ci) => (
                            <ConditionCard key={ci} cond={cond} index={ci} />
                        ))}
                        {gi < groups.length - 1 && (
                            <InlineStack align="center">
                                <Badge tone="info">OR</Badge>
                            </InlineStack>
                        )}
                    </BlockStack>
                ))}

                {/* Redirect URL */}
                {rule.redirect_url && (
                    <>
                        <Divider />
                        <InfoRow label="Redirect URL">
                            <Text variant="bodySm" as="span" breakWord>
                                {rule.redirect_url}
                            </Text>
                        </InfoRow>
                    </>
                )}

                {/* Price-hide settings */}
                {rule.price_message && (
                    <>
                        <Divider />
                        <InfoRow label="Hidden price msg">
                            <Text variant="bodySm" as="span">
                                {rule.price_message}
                            </Text>
                        </InfoRow>
                    </>
                )}
            </BlockStack>
        </Card>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LockConfigurePage() {
    const { lock, previewMode } = usePage().props;

    if (!lock) {
        return (
            <Page title="Lock Preview" backAction={{ content: 'Dashboard', onAction: () => router.visit('/') }}>
                <Banner title="Lock not found" tone="critical">
                    <Text>This lock could not be found or you do not have access to it.</Text>
                </Banner>
            </Page>
        );
    }

    const isActive =
        lock.status === true || lock.status === 1 || lock.status === '1' || lock.status === 'Active';

    const accessRules = lock.access_rules || lock.accessRules || [];
    const widget = lock.widget || null;
    const resourceTypes = resourceTypesFromRules(accessRules);
    const kindLabel = lockKindLabel(lock.type);

    const createdAt = lock.created_at
        ? new Date(lock.created_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '—';
    const updatedAt = lock.updated_at
        ? new Date(lock.updated_at).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })
        : '—';

    return (
        <Page
            title={lock.name || 'Lock Preview'}
            titleMetadata={
                <InlineStack gap="200">
                    <Badge tone={isActive ? 'success' : 'attention'}>{isActive ? 'Active' : 'Inactive'}</Badge>
                    {resourceTypes.map(({ type, count }) => (
                        <Badge key={type}>{resourceTypeLabel(type, count)}</Badge>
                    ))}
                    {kindLabel && <Badge tone="warning">{kindLabel}</Badge>}
                </InlineStack>
            }
            subtitle={lock.description || undefined}
            backAction={{ content: 'Dashboard', onAction: () => router.visit('/') }}
            secondaryActions={
                previewMode
                    ? [
                          {
                              content: 'Edit lock',
                              onAction: () => router.visit(`/lock/${lock.id}/configure`),
                          },
                      ]
                    : []
            }
        >
            {previewMode && (
                <div style={{ marginBottom: 16 }}>
                    <Banner tone="info">
                        <Text>You are viewing this lock in <strong>preview mode</strong>. No changes can be made here.</Text>
                    </Banner>
                </div>
            )}

            <Layout>
                <Layout.Section>
                    <InlineGrid columns={{ xs: '1fr', md: '1fr 300px' }} gap="400">
                        {/* ── Left: Access Rules ── */}
                        <BlockStack gap="400">
                            <Card padding="0">
                                <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                                    <InlineStack align="space-between" blockAlign="center">
                                        <Text variant="headingMd" as="h2">
                                            Access Rules
                                        </Text>
                                        <Badge>{accessRules.length} rule{accessRules.length !== 1 ? 's' : ''}</Badge>
                                    </InlineStack>
                                </Box>

                                <Box padding="400">
                                    {accessRules.length > 0 ? (
                                        <BlockStack gap="400">
                                            {accessRules.map((rule, i) => (
                                                <RuleCard key={rule.id ?? i} rule={rule} />
                                            ))}
                                        </BlockStack>
                                    ) : (
                                        <Box paddingBlock="600">
                                            <InlineStack align="center">
                                                <Text tone="subdued">No access rules configured for this lock.</Text>
                                            </InlineStack>
                                        </Box>
                                    )}
                                </Box>
                            </Card>
                        </BlockStack>

                        {/* ── Right: Meta sidebar ── */}
                        <BlockStack gap="400">
                            {/* Lock details */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Lock Details
                                    </Text>
                                    <Divider />
                                    <BlockStack gap="300">
                                        <InfoRow label="ID">
                                            <Text variant="bodySm" as="span" tone="subdued">
                                                #{lock.id}
                                            </Text>
                                        </InfoRow>
                                        <InfoRow label="Type">
                                            <InlineStack gap="100" wrap>
                                                {resourceTypes.length > 0 ? (
                                                    resourceTypes.map(({ type, count }) => (
                                                        <Badge key={type}>{resourceTypeLabel(type, count)}</Badge>
                                                    ))
                                                ) : (
                                                    <Text variant="bodySm" as="span" tone="subdued">No items</Text>
                                                )}
                                                {kindLabel && <Badge tone="warning">{kindLabel}</Badge>}
                                            </InlineStack>
                                        </InfoRow>
                                        <InfoRow label="Status">
                                            <Badge tone={isActive ? 'success' : 'attention'}>
                                                {isActive ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </InfoRow>
                                        <InfoRow label="Created">
                                            <Text variant="bodySm" as="span">
                                                {createdAt}
                                            </Text>
                                        </InfoRow>
                                        <InfoRow label="Updated">
                                            <Text variant="bodySm" as="span">
                                                {updatedAt}
                                            </Text>
                                        </InfoRow>
                                        {lock.starts_at && (
                                            <InfoRow label="Starts at">
                                                <Text variant="bodySm" as="span">
                                                    {new Date(lock.starts_at).toLocaleString()}
                                                </Text>
                                            </InfoRow>
                                        )}
                                        {lock.expires_at && (
                                            <InfoRow label="Expires at">
                                                <Text variant="bodySm" as="span">
                                                    {new Date(lock.expires_at).toLocaleString()}
                                                </Text>
                                            </InfoRow>
                                        )}
                                    </BlockStack>
                                </BlockStack>
                            </Card>

                            {/* Widget info */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Widget
                                    </Text>
                                    <Divider />
                                    {widget ? (
                                        <BlockStack gap="200">
                                            <InfoRow label="Name">
                                                <Text variant="bodySm" fontWeight="semibold" as="span">
                                                    {widget.name}
                                                </Text>
                                            </InfoRow>
                                            <InfoRow label="Type">
                                                <Text variant="bodySm" as="span">
                                                    {widget.type}
                                                </Text>
                                            </InfoRow>
                                        </BlockStack>
                                    ) : (
                                        <Text tone="subdued" variant="bodySm">
                                            Using default design (no custom widget assigned).
                                        </Text>
                                    )}
                                </BlockStack>
                            </Card>

                            {/* Quick stats */}
                            <Card>
                                <BlockStack gap="400">
                                    <Text variant="headingMd" as="h2">
                                        Summary
                                    </Text>
                                    <Divider />
                                    <BlockStack gap="200">
                                        <InfoRow label="Rules">
                                            <Text variant="bodySm" fontWeight="semibold" as="span">
                                                {accessRules.length}
                                            </Text>
                                        </InfoRow>
                                        <InfoRow label="Active rules">
                                            <Text variant="bodySm" fontWeight="semibold" as="span">
                                                {accessRules.filter((r) => r.enabled).length}
                                            </Text>
                                        </InfoRow>
                                        <InfoRow label="Resources">
                                            <Text variant="bodySm" fontWeight="semibold" as="span">
                                                {resourceTypes
                                                    .map(({ type, count }) => resourceTypeLabel(type, count))
                                                    .join(', ') || '—'}
                                            </Text>
                                        </InfoRow>
                                    </BlockStack>
                                </BlockStack>
                            </Card>

                            {previewMode && (
                                <Button
                                    variant="primary"
                                    fullWidth
                                    onClick={() => router.visit(`/lock/${lock.id}/configure`)}
                                >
                                    Edit this lock
                                </Button>
                            )}
                        </BlockStack>
                    </InlineGrid>
                </Layout.Section>
            </Layout>
        </Page>
    );
}