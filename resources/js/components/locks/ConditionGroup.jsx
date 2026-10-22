import { Badge, BlockStack, Box, Button, Card, Divider, InlineStack, Select, Text } from '@shopify/polaris';
import { useCallback } from 'react';
import ConditionRow from './ConditionRow';

export default function ConditionGroup({ group, onChange, onRemove, onAddCondition, index }) {
    const setGroupField = useCallback((key, value) => onChange({ ...group, [key]: value }), [group, onChange]);

    const updateCondition = useCallback(
        (idx, updated) => {
            const next = [...group.conditions];
            next[idx] = updated;
            setGroupField('conditions', next);
        },
        [group.conditions, setGroupField],
    );

    const removeCondition = useCallback(
        (idx) => {
            const next = group.conditions.filter((_, i) => i !== idx);
            setGroupField('conditions', next);
        },
        [group.conditions, setGroupField],
    );

    return (
        <Card padding="0">
            <Box padding="400">
                <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                            <Badge tone={group.operator === 'AND' ? 'success' : 'attention'}>
                                {group.operator === 'AND' ? 'All must match' : 'Any can match'}
                            </Badge>
                            <Text as="span" tone="subdued">
                                Key {index + 1} • {group.conditions.length} condition{group.conditions.length !== 1 ? 's' : ''}
                            </Text>
                        </InlineStack>
                        <InlineStack gap="200">
                            <Select
                                label="Operator"
                                labelHidden
                                options={[
                                    { label: 'AND (all must match)', value: 'AND' },
                                    { label: 'OR (any can match)', value: 'OR' },
                                ]}
                                value={group.operator}
                                onChange={(v) => setGroupField('operator', v)}
                            />
                            <Button tone="critical" onClick={onRemove}>
                                Remove key
                            </Button>
                        </InlineStack>
                    </InlineStack>
                    <Text as="p" tone="subdued">
                        To use this key, a customer must meet {group.operator === 'AND' ? 'all' : 'any'} of its conditions.
                    </Text>
                </BlockStack>
            </Box>
            <Divider />
            <Box padding="400">
                <BlockStack gap="400">
                    {group.conditions.map((c, idx) => (
                        <ConditionRow
                            key={idx}
                            condition={c}
                            onChange={(updated) => updateCondition(idx, updated)}
                            onRemove={() => removeCondition(idx)}
                            index={idx}
                        />
                    ))}
                    <Button onClick={onAddCondition} variant="plain">
                        + Add condition to this key
                    </Button>
                </BlockStack>
            </Box>
        </Card>
    );
}
