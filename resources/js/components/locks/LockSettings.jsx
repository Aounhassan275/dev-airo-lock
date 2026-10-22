import { BlockStack, Box, Card, Checkbox, Divider, Icon, InlineGrid, Select, Text, TextField } from '@shopify/polaris';
import { CalendarIcon, ClockIcon } from '@shopify/polaris-icons';

export default function LockSettings({
    enabled,
    setEnabled,
    lockType,
    startDate,
    setStartDate,
    startTime,
    setStartTime,
    endDate,
    setEndDate,
    endTime,
    setEndTime,
    widgets,
    lockConfig,
    updateLockConfig,
}) {
    return (
        <BlockStack gap="400">
            {/* Settings */}
            <Card>
                <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                        Settings
                    </Text>
                    <Divider />
                    <Checkbox label="Enable this lock" checked={enabled} onChange={setEnabled} />
                    {lockType !== 'price_hide' && (
                        <BlockStack gap="400">
                            <Box>
                                <InlineGrid columns={2} gap="400">
                                    <TextField
                                        label="Start date"
                                        type="date"
                                        value={startDate}
                                        onChange={setStartDate}
                                        autoComplete="off"
                                        prefix={<Icon source={CalendarIcon} />}
                                    />
                                    <TextField
                                        label="Time"
                                        type="time"
                                        value={startTime}
                                        onChange={setStartTime}
                                        autoComplete="off"
                                        prefix={<Icon source={ClockIcon} />}
                                    />
                                </InlineGrid>
                                <Box paddingBlockStart="100">
                                    <Text tone="subdued" variant="bodySm">
                                        The date and time the lock will become active.
                                    </Text>
                                </Box>
                            </Box>

                            <Box>
                                <InlineGrid columns={2} gap="400">
                                    <TextField
                                        label="End date"
                                        type="date"
                                        value={endDate}
                                        onChange={setEndDate}
                                        autoComplete="off"
                                        prefix={<Icon source={CalendarIcon} />}
                                    />
                                    <TextField
                                        label="Time"
                                        type="time"
                                        value={endTime}
                                        onChange={setEndTime}
                                        autoComplete="off"
                                        prefix={<Icon source={ClockIcon} />}
                                    />
                                </InlineGrid>
                                <Box paddingBlockStart="100">
                                    <Text tone="subdued" variant="bodySm">
                                        The date and time the lock will become inactive.
                                    </Text>
                                </Box>
                            </Box>
                        </BlockStack>
                    )}
                </BlockStack>
            </Card>

            {/* Widget Selection */}
            <Card>
                <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">
                        Widget
                    </Text>
                    <Divider />
                    <Select
                        label="Select Widget"
                        options={[{ label: 'Select a widget', value: '' }, ...widgets.map((w) => ({ label: w.name, value: String(w.id) }))]}
                        value={lockConfig.widget_id ? String(lockConfig.widget_id) : ''}
                        onChange={(value) => updateLockConfig({ widget_id: value })}
                        helpText="Select an active widget to display on this lock screen"
                    />
                </BlockStack>
            </Card>
        </BlockStack>
    );
}
