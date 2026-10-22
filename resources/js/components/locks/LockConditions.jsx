import { BlockStack, Box, Button, Card, Checkbox, Divider, Icon, InlineStack, Text } from '@shopify/polaris';
import { EmailIcon } from '@shopify/polaris-icons';
import ConditionGroup from './ConditionGroup';

export default function LockConditions({
    groups,
    updateGroup,
    removeGroup,
    addConditionToGroup,
    addGroup,
    userRequestByEmail,
    setUserRequestByEmail,
}) {
    return (
        <Card>
            <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                    Lock Conditions
                </Text>
                <Text as="p" tone="subdued">
                    Select condition to apply the lock
                </Text>
                <Divider />

                {/* User Request by Email Checkbox */}
                <Box padding="200" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                        <Checkbox
                            label="User request by email"
                            checked={userRequestByEmail}
                            onChange={setUserRequestByEmail}
                            helpText="Allow users to request access by submitting their email address"
                        />
                        {userRequestByEmail && (
                            <Box paddingInlineStart="600">
                                <InlineStack gap="200" blockAlign="center">
                                    <Icon source={EmailIcon} tone="subdued" />
                                    <Text variant="bodySm" tone="subdued">
                                        Users will see an email input form to request access
                                    </Text>
                                </InlineStack>
                            </Box>
                        )}
                    </BlockStack>
                </Box>

                <Divider />

                {groups.map((group, idx) => (
                    <ConditionGroup
                        key={idx}
                        group={group}
                        onChange={(updated) => updateGroup(idx, updated)}
                        onRemove={() => removeGroup(idx)}
                        onAddCondition={() => addConditionToGroup(idx)}
                        index={idx}
                    />
                ))}
                <Button onClick={addGroup} variant="plain">
                    + Add key
                </Button>
            </BlockStack>
        </Card>
    );
}
