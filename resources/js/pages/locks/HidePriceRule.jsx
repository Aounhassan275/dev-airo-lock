import {
    Banner,
    BlockStack,
    Box,
    Button,
    Card,
    Checkbox,
    Divider,
    FormLayout,
    Icon,
    InlineGrid,
    InlineStack,
    Text,
    TextField,
} from '@shopify/polaris';
import { ArrowLeftIcon, InfoIcon, ProductIcon } from '@shopify/polaris-icons';
import { useCallback, useState } from 'react';

const HidePriceRule = ({ 
    lockConfig, 
    updateLockConfig, 
    onBack, 
    onSubmit, 
    isSubmitting = false,
    isEmbedded = false,
}) => {
    // Local state for additional settings
    const [localPriceMessage, setLocalPriceMessage] = useState(
        lockConfig?.priceMessage || 'Sign in to see price'
    );
    const [localHideOnAllPages, setLocalHideOnAllPages] = useState(
        lockConfig?.hideOnAllPages ?? true
    );
    const [localHideOnCheckout, setLocalHideOnCheckout] = useState(
        lockConfig?.hideOnCheckout ?? true
    );

    // Handle save
    const handleSave = useCallback(() => {
        const finalConfig = {
            priceMessage: localPriceMessage,
            hideOnAllPages: localHideOnAllPages,
            hideOnCheckout: localHideOnCheckout,
        };

        if (onSubmit) {
            onSubmit(finalConfig);
        }
    }, [localPriceMessage, localHideOnAllPages, localHideOnCheckout, onSubmit]);

    // Sync with parent state on changes
    const handlePriceMessageChange = useCallback((value) => {
        setLocalPriceMessage(value);
        if (updateLockConfig) {
            updateLockConfig({ priceMessage: value });
        }
    }, [updateLockConfig]);

    const handleHideOnAllPagesChange = useCallback((checked) => {
        setLocalHideOnAllPages(checked);
        if (updateLockConfig) {
            updateLockConfig({ hideOnAllPages: checked });
        }
    }, [updateLockConfig]);

    const handleHideOnCheckoutChange = useCallback((checked) => {
        setLocalHideOnCheckout(checked);
        if (updateLockConfig) {
            updateLockConfig({ hideOnCheckout: checked });
        }
    }, [updateLockConfig]);

    const selectedItemsCount = lockConfig?.selectedItems?.length || 0;

    return (
        <BlockStack gap="400">
            {/* Back Button and Header */}
            {isEmbedded && (
                <InlineStack align="space-between" blockAlign="center">
                    <Button 
                        onClick={onBack} 
                        icon={ArrowLeftIcon}
                        variant="plain"
                    >
                        Back to Content Selection
                    </Button>
                    <Button 
                        variant="primary"
                        onClick={handleSave}
                        loading={isSubmitting}
                        disabled={selectedItemsCount === 0}
                    >
                        Save Price Rule
                    </Button>
                </InlineStack>
            )}

            {/* Info Banner */}
            <Banner tone="info">
                <Text as="p">
                    This rule will hide prices for {selectedItemsCount} selected product(s) without blocking access to the page.
                </Text>
            </Banner>

            <InlineGrid columns={{ xs: '1fr', md: '2fr 1fr' }} gap="400">
                {/* Left Column - Main Settings */}
                <BlockStack gap="400">
                    <Card>
                        <Box padding="400">
                            <BlockStack gap="400">
                                <InlineStack gap="200" blockAlign="center">
                                    <Icon source={ProductIcon} tone="success" />
                                    <Text variant="headingMd" as="h2">
                                        Price Visibility Settings
                                    </Text>
                                </InlineStack>

                                <Divider />

                                <FormLayout>
                                    <TextField
                                        label="Rule Name"
                                        value={lockConfig?.name || 'Hide Price Rule'}
                                        onChange={(value) => updateLockConfig?.({ name: value })}
                                        autoComplete="off"
                                        helpText="A name to identify this price rule"
                                    />

                                    <TextField
                                        label="Price Hidden Message"
                                        value={localPriceMessage}
                                        onChange={handlePriceMessageChange}
                                        helpText="Message to display in place of the price"
                                        autoComplete="off"
                                        placeholder="Sign in to see price"
                                    />

                                    <BlockStack gap="300">
                                        <Text variant="bodyMd" fontWeight="medium">
                                            Visibility Options
                                        </Text>
                                        
                                        <Checkbox
                                            label="Hide on all pages (Collections, Search, etc.)"
                                            checked={localHideOnAllPages}
                                            onChange={handleHideOnAllPagesChange}
                                            helpText="Price will be hidden wherever the product appears"
                                        />
                                        
                                        <Checkbox
                                            label="Disallow Add to Cart / Checkout"
                                            checked={localHideOnCheckout}
                                            onChange={handleHideOnCheckoutChange}
                                            helpText="Hides 'Add to Cart' buttons and prevents checkout"
                                        />
                                    </BlockStack>
                                </FormLayout>
                            </BlockStack>
                        </Box>
                    </Card>

                    <Card>
                        <Box padding="400">
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h3">
                                    How It Works
                                </Text>
                                <Divider />
                                <BlockStack gap="200">
                                    <InlineStack gap="200" blockAlign="start">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                                            1
                                        </div>
                                        <Text as="p" variant="bodyMd">
                                            Prices are hidden for selected products
                                        </Text>
                                    </InlineStack>
                                    <InlineStack gap="200" blockAlign="start">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                                            2
                                        </div>
                                        <Text as="p" variant="bodyMd">
                                            Custom message is displayed in place of price
                                        </Text>
                                    </InlineStack>
                                    <InlineStack gap="200" blockAlign="start">
                                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-600">
                                            3
                                        </div>
                                        <Text as="p" variant="bodyMd">
                                            Add to Cart buttons are optionally hidden
                                        </Text>
                                    </InlineStack>
                                </BlockStack>
                            </BlockStack>
                        </Box>
                    </Card>
                </BlockStack>

                {/* Right Column - Summary */}
                <BlockStack gap="400">
                    <Card>
                        <Box padding="400">
                            <BlockStack gap="400">
                                <Text variant="headingMd" as="h3">
                                    Rule Summary
                                </Text>
                                <Divider />
                                <BlockStack gap="200">
                                    <InlineStack align="space-between">
                                        <Text variant="bodySm" tone="subdued">Products affected</Text>
                                        <Text variant="bodySm" fontWeight="medium">
                                            {selectedItemsCount}
                                        </Text>
                                    </InlineStack>
                                    <InlineStack align="space-between">
                                        <Text variant="bodySm" tone="subdued">Price visibility</Text>
                                        <Text variant="bodySm" fontWeight="medium">
                                            Hidden
                                        </Text>
                                    </InlineStack>
                                    <InlineStack align="space-between">
                                        <Text variant="bodySm" tone="subdued">Add to Cart</Text>
                                        <Text variant="bodySm" fontWeight="medium">
                                            {localHideOnCheckout ? 'Disabled' : 'Enabled'}
                                        </Text>
                                    </InlineStack>
                                </BlockStack>
                            </BlockStack>
                        </Box>
                    </Card>

                    {/* <Card>
                        <Box padding="200">
                            <InlineStack gap="200" blockAlign="center">
                                <Icon source={InfoIcon} tone="subdued" />
                                <Text as="span" tone="subdued" variant="bodySm">
                                    Customers will see the configured message instead of prices.
                                </Text>
                            </InlineStack>
                        </Box>
                    </Card> */}

                    {/* Save Button */}
                    <Card>
                        <Box padding="400">
                            <BlockStack gap="300">
                                <Button 
                                    variant="primary"
                                    size="large"
                                    fullWidth
                                    onClick={handleSave}
                                    loading={isSubmitting}
                                    disabled={selectedItemsCount === 0}
                                >
                                    Save Price Rule
                                </Button>
                                <Text variant="bodySm" tone="subdued" alignment="center">
                                    {selectedItemsCount} product{selectedItemsCount !== 1 ? 's' : ''} will be affected
                                </Text>
                            </BlockStack>
                        </Box>
                    </Card>
                </BlockStack>
            </InlineGrid>
        </BlockStack>
    );
};

export default HidePriceRule;