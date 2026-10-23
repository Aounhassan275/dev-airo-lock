import { router } from '@inertiajs/react';
import { Modal, TitleBar } from '@shopify/app-bridge-react';
import { Box, Button, InlineStack, Text, TextField } from '@shopify/polaris';
import { PlusIcon } from '@shopify/polaris-icons';
import { useCallback, useState } from 'react';
import DynamicFormWidget from '../../pages/widget/Widgets';
import TextWidget from '../../pages/widget/TextWidget';

/**
 * Create a widget design from inside the lock builder.
 *
 * Picking a design is part of building a lock, but the only way to make one was
 * the widget editor — and getting there meant abandoning a half-built lock.
 *
 * This is the SAME editor the Widgets dashboard uses, rendered whole in one
 * modal: name, colours, layout, language and live preview on a single screen.
 * The dashboard walks through name → type → design as three steps; there is no
 * type step here because the button already knows which list it belongs to, and
 * no name step because asking for one field at a time is not worth a wizard.
 *
 * The endpoint redirects BACK, so with `preserveState` the builder keeps every
 * field the merchant has filled in while the widget list refreshes underneath.
 *
 * @param {'form'|'text'} type       which widget list this creates into
 * @param {Array}         widgets    the current list, to spot the new row by id
 * @param {Function}      onCreated  called with the new widget's id
 */
export default function CreateWidgetButton({
    type,
    widgets = [],
    onCreated,
    storeLocales = [],
    primaryLocale = '',
    // Optional: (open) => node. Lets a screen draw its own trigger (the lock
    // builder's "+ Create widget" tile) while keeping this editor and flow.
    renderTrigger = null,
}) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [nameError, setNameError] = useState('');

    const isText = type === 'text';
    const label = isText ? 'text widget' : 'form widget';

    const close = useCallback(() => {
        setOpen(false);
        setName('');
        setNameError('');
        setSaving(false);
    }, []);

    const submit = useCallback(
        (configuration) => {
            const trimmed = name.trim();
            if (!trimmed) {
                setNameError('Give the design a name so you can find it later.');
                return;
            }

            const knownIds = new Set(widgets.map((w) => String(w.id)));
            setSaving(true);
            setNameError('');

            router.post(
                '/widgets/quick-create',
                { name: trimmed, type, configuration },
                {
                    // The whole point: the lock being built must survive this.
                    preserveState: true,
                    preserveScroll: true,
                    onSuccess: (page) => {
                        const list = page.props[isText ? 'textWidgets' : 'formWidgets'] || [];
                        // Identify by id — two designs may share a name.
                        const created = list.find((w) => !knownIds.has(String(w.id)));
                        if (created) onCreated(String(created.id));
                        close();
                    },
                    onError: () => setNameError('Could not create the widget. Please try again.'),
                    onFinish: () => setSaving(false),
                },
            );
        },
        [name, widgets, type, isText, onCreated, close],
    );

    const languageProps = { storeLocales, primaryLocale };

    return (
        <>
            {renderTrigger ? (
                renderTrigger(() => setOpen(true))
            ) : (
                <Button icon={PlusIcon} variant="plain" onClick={() => setOpen(true)}>
                    Create widget
                </Button>
            )}

            <Modal id={`create-${type}-widget-from-lock`} open={open} variant="max">
                <TitleBar title={`Create a ${label}`}>
                    <button onClick={close} disabled={saving}>
                        Cancel
                    </button>
                </TitleBar>

                <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                    <InlineStack gap="400" blockAlign="start" wrap={false}>
                        <div style={{ flex: 1, maxWidth: 420 }}>
                            <TextField
                                label="Design name"
                                value={name}
                                onChange={(v) => {
                                    setName(v);
                                    if (nameError) setNameError('');
                                }}
                                autoComplete="off"
                                placeholder="e.g. VIP launch"
                                error={nameError || undefined}
                                requiredIndicator
                                disabled={saving}
                            />
                        </div>
                        <Box paddingBlockStart="600">
                            <Text as="p" variant="bodySm" tone="subdued">
                                Design it below, then save — your work on the lock is kept.
                            </Text>
                        </Box>
                    </InlineStack>
                </Box>

                {/* The real editor. Its own Save button hands back the finished
                    configuration, exactly as it does on the Widgets dashboard. */}
                {open ? (
                    isText ? (
                        <TextWidget
                            widgetName={name || 'Untitled'}
                            onSubmit={submit}
                            onCancel={close}
                            isCreating={saving}
                            {...languageProps}
                        />
                    ) : (
                        <DynamicFormWidget
                            onSubmit={submit}
                            onCancel={close}
                            formTitle={name ? `Create: ${name}` : 'Create widget'}
                            isCreating={saving}
                            {...languageProps}
                        />
                    )
                ) : null}
            </Modal>
        </>
    );
}
