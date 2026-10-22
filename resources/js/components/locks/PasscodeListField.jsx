import {
    Badge,
    Banner,
    BlockStack,
    Button,
    ChoiceList,
    DropZone,
    InlineStack,
    Modal,
    Pagination,
    Text,
    TextField,
} from '@shopify/polaris';
import { DeleteIcon, ExportIcon, ImportIcon, PlusIcon } from '@shopify/polaris-icons';
import { useEffect, useMemo, useState } from 'react';
import {
    countDuplicates,
    isValidEmail,
    listFilename,
    listHeader,
    MAX_LIST_ITEMS,
    parseBulkList,
    templateCsv,
    toCsv,
} from '../../lib/bulkList';
import { copyText, downloadTextFile } from '../../lib/downloadFile';
import { joinListValue, splitListValue } from '../../lib/listValue';

// Above this many entries the plain stack of inputs stops being usable, so a
// search box and paging appear. Merchants granting access to a customer list
// routinely land in the hundreds — rendering 200 Polaris TextFields at once is
// both slow and impossible to navigate.
const BROWSE_THRESHOLD = 10;
const PAGE_SIZE = 20;

/**
 * One input field per value, stored upstream as the newline-joined string
 * the storefront validator expects. Replaces the "one per line" textarea,
 * whose placeholder rendered a literal '\n' and taught merchants to save
 * backslash-separated values as one giant passcode.
 *
 * `kind` ('passcode' | 'email') only affects validation and wording — an email
 * list is stored exactly like a passcode list.
 */
export default function PasscodeListField({
    label,
    value,
    onChange,
    itemLabel = 'Passcode',
    addLabel = 'Add another passcode',
    helpText,
    placeholder,
    kind = 'passcode',
}) {
    // Fields derive from the prop on every render — the parent's condition
    // state stays the single source of truth, so a discard/reset that
    // restores it WITHOUT remounting this component is reflected here
    // immediately (local state would keep showing the discarded edits).
    const items = splitListValue(value);

    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [exportNotice, setExportNotice] = useState('');

    // A legacy backslash-separated save parses into several items — rewrite
    // it as the canonical newline-joined value so the next save repairs the
    // condition. Typed input can't contain separators (stripped below), so
    // after one rewrite joined === value and this can never fire again.
    useEffect(() => {
        const joined = joinListValue(items);
        if (joined !== String(value ?? '')) onChange(joined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const update = (next) => onChange(joinListValue(next));

    const filled = items.filter((item) => item.trim() !== '');
    const browsing = items.length > BROWSE_THRESHOLD;
    const duplicates = countDuplicates(items, kind);
    const invalidEmails = kind === 'email' ? filled.filter((item) => !isValidEmail(item)).length : 0;
    const noun = itemLabel.toLowerCase();

    // Indices travel with the rows: editing and removing address the real
    // position in `items`, not the position on the current page.
    const matched = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return items
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => (needle ? item.toLowerCase().includes(needle) : true));
    }, [items, query]);

    const visible = browsing ? matched.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : matched;

    // Deleting down to a shorter list (or narrowing the search) can leave the
    // page index past the end, which renders an empty list with no way back.
    useEffect(() => {
        const lastPage = Math.max(0, Math.ceil(matched.length / PAGE_SIZE) - 1);
        if (page > lastPage) setPage(lastPage);
    }, [matched.length, page]);

    // Exports the whole list, not the current page or search — the point is to
    // get the list out (to review it, hand it to someone, or keep it in a
    // spreadsheet as the source of truth and re-upload after editing).
    const handleExport = async () => {
        if (downloadTextFile(listFilename(kind), toCsv(filled, kind))) {
            setExportNotice('');

            return;
        }
        const copied = await copyText(filled.join('\n'));
        setExportNotice(
            copied
                ? 'Your browser blocked the download, so the list was copied to your clipboard instead.'
                : 'Your browser blocked the download, and the clipboard is not available either.',
        );
    };

    return (
        <BlockStack gap="200">
            <InlineStack align="space-between" blockAlign="center" gap="200">
                <InlineStack gap="200" blockAlign="center">
                    {label ? (
                        <Text as="p" variant="bodyMd">
                            {label}
                        </Text>
                    ) : null}
                    {filled.length > 1 ? (
                        <Badge tone="info">{`${filled.length} ${noun}${filled.length === 1 ? '' : 's'}`}</Badge>
                    ) : null}
                </InlineStack>
                <InlineStack gap="200" blockAlign="center">
                    <Button icon={ImportIcon} onClick={() => setBulkOpen(true)}>
                        Add in bulk
                    </Button>
                    {filled.length > 0 ? (
                        <Button icon={ExportIcon} onClick={handleExport}>
                            Download CSV
                        </Button>
                    ) : null}
                    {items.length > 1 ? (
                        <Button variant="plain" tone="critical" onClick={() => update([''])}>
                            Remove all
                        </Button>
                    ) : null}
                </InlineStack>
            </InlineStack>

            {exportNotice ? (
                <Banner tone="warning" onDismiss={() => setExportNotice('')}>
                    {exportNotice}
                </Banner>
            ) : null}

            {duplicates > 0 || invalidEmails > 0 ? (
                <Banner tone="warning">
                    {duplicates > 0 ? `${duplicates} duplicate ${duplicates === 1 ? 'entry' : 'entries'}. ` : ''}
                    {invalidEmails > 0
                        ? `${invalidEmails} ${invalidEmails === 1 ? 'entry is not a valid email address' : 'entries are not valid email addresses'}. `
                        : ''}
                    Duplicates are harmless — the storefront accepts each value once.
                </Banner>
            ) : null}

            {browsing ? (
                <TextField
                    label={`Search ${noun}s`}
                    labelHidden
                    value={query}
                    onChange={(v) => {
                        setQuery(v);
                        setPage(0);
                    }}
                    autoComplete="off"
                    placeholder={`Search ${items.length} ${noun}s`}
                    clearButton
                    onClearButtonClick={() => {
                        setQuery('');
                        setPage(0);
                    }}
                />
            ) : null}

            {visible.length === 0 ? (
                <Text as="p" variant="bodySm" tone="subdued">
                    {`No ${noun}s match "${query}".`}
                </Text>
            ) : null}

            {visible.map(({ item, index }) => (
                <TextField
                    key={index}
                    label={`${itemLabel} ${index + 1}`}
                    value={item}
                    // Backslash and newline are the storage separators — they
                    // can never be part of a single value.
                    onChange={(v) => update(items.map((it, j) => (j === index ? v.replace(/[\\\n]/g, '') : it)))}
                    autoComplete="off"
                    placeholder={placeholder}
                    error={
                        kind === 'email' && item.trim() !== '' && !isValidEmail(item)
                            ? 'Not a valid email address'
                            : undefined
                    }
                    connectedRight={
                        items.length > 1 ? (
                            <Button
                                icon={DeleteIcon}
                                accessibilityLabel={`Remove ${noun} ${index + 1}`}
                                onClick={() => update(items.filter((_, j) => j !== index))}
                            />
                        ) : undefined
                    }
                />
            ))}

            {browsing && matched.length > PAGE_SIZE ? (
                <InlineStack align="center">
                    <Pagination
                        hasPrevious={page > 0}
                        onPrevious={() => setPage((p) => Math.max(0, p - 1))}
                        hasNext={(page + 1) * PAGE_SIZE < matched.length}
                        onNext={() => setPage((p) => p + 1)}
                        label={`${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, matched.length)} of ${matched.length}`}
                    />
                </InlineStack>
            ) : null}

            <div>
                <Button icon={PlusIcon} variant="plain" onClick={() => update([...items, ''])}>
                    {addLabel}
                </Button>
            </div>

            {helpText ? (
                <Text as="p" variant="bodySm" tone="subdued">
                    {helpText}
                </Text>
            ) : null}

            <BulkAddModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                kind={kind}
                itemLabel={itemLabel}
                existing={items}
                onApply={(next) => {
                    update(next);
                    setBulkOpen(false);
                    setQuery('');
                    setPage(0);
                }}
            />
        </BlockStack>
    );
}

/**
 * Paste or upload a list. Parsing runs live against the current text so the
 * merchant sees what will actually be added — including what is being dropped
 * and why — before committing to it.
 */
function BulkAddModal({ open, onClose, kind, itemLabel, existing, onApply }) {
    const [text, setText] = useState('');
    const [mode, setMode] = useState('append');
    // { tone, message } — a rejected file is an error, a blocked download is
    // just information, and both land in the same slot under the drop zone.
    const [notice, setNotice] = useState(null);

    // Each open starts clean: leftover text from a previous paste silently
    // re-adding itself would be the worst surprise on a 200-entry list.
    useEffect(() => {
        if (open) {
            setText('');
            setMode('append');
            setNotice(null);
        }
    }, [open]);

    const noun = itemLabel.toLowerCase();
    const nonEmpty = existing.filter((item) => item.trim() !== '');
    const keptExisting = mode === 'append' ? nonEmpty : [];

    // Parsing de-dupes against whatever survives the append/replace choice, so
    // the preview counts change the moment that choice does.
    const parsed = parseBulkList(text, { kind, existing: keptExisting });

    const total = keptExisting.length + parsed.values.length;
    const overLimit = total > MAX_LIST_ITEMS;

    const handleDrop = (_files, accepted) => {
        const file = accepted?.[0];
        if (!file) {
            setNotice({ tone: 'critical', message: 'That file type is not supported. Upload a .csv or .txt file.' });
            return;
        }
        setNotice(null);
        const reader = new FileReader();
        reader.onerror = () => setNotice({ tone: 'critical', message: `Could not read ${file.name}.` });
        // Appended, not replaced, so uploading a second file adds to the first.
        reader.onload = () => setText((current) => (current ? `${current}\n${reader.result}` : String(reader.result)));
        reader.readAsText(file);
    };

    // Falls back to dropping the template into the textarea, which is where the
    // merchant would have pasted it anyway — so a blocked download still leaves
    // them with a working example of the format.
    const handleTemplate = () => {
        const csv = templateCsv(kind);
        if (downloadTextFile(`${listHeader(kind)}-template.csv`, csv)) {
            setNotice(null);

            return;
        }
        setText(csv);
        setNotice({
            tone: 'info',
            message: 'Your browser blocked the download, so the template was put in the box above instead.',
        });
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Add ${noun}s in bulk`}
            primaryAction={{
                content: parsed.values.length
                    ? `Add ${parsed.values.length} ${noun}${parsed.values.length === 1 ? '' : 's'}`
                    : 'Add',
                disabled: parsed.values.length === 0 || overLimit,
                onAction: () => onApply([...keptExisting, ...parsed.values]),
            }}
            secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
        >
            <Modal.Section>
                <BlockStack gap="400">
                    <TextField
                        label={`Paste ${noun}s`}
                        value={text}
                        onChange={setText}
                        multiline={8}
                        autoComplete="off"
                        // Comma-separated rather than newline-separated on
                        // purpose: a placeholder showing line breaks is what
                        // taught merchants to type literal separators into the
                        // old textarea (see listValue.js).
                        placeholder={
                            kind === 'email'
                                ? 'customer1@example.com, customer2@example.com, customer3@example.com'
                                : 'VIP-0001, VIP-0002, VIP-0003'
                        }
                        helpText="One per line, or separated by commas, semicolons or tabs — paste straight from a spreadsheet."
                    />

                    <DropZone
                        accept=".csv,.txt,text/csv,text/plain"
                        type="file"
                        allowMultiple={false}
                        onDrop={handleDrop}
                    >
                        <DropZone.FileUpload actionTitle="Upload a file" actionHint="Accepts .csv and .txt" />
                    </DropZone>

                    <InlineStack gap="200" blockAlign="center">
                        <Button icon={ExportIcon} variant="plain" onClick={handleTemplate}>
                            Download a template
                        </Button>
                        <Text as="span" variant="bodySm" tone="subdued">
                            {`A .csv with a "${listHeader(kind)}" heading and one value per row — fill it in and upload it back.`}
                        </Text>
                    </InlineStack>

                    {notice ? (
                        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
                            {notice.message}
                        </Banner>
                    ) : null}

                    {nonEmpty.length > 0 ? (
                        <ChoiceList
                            title={`${nonEmpty.length} ${noun}${nonEmpty.length === 1 ? '' : 's'} already in this list`}
                            choices={[
                                { label: 'Keep them and add to the list', value: 'append' },
                                { label: 'Replace the list with what I paste', value: 'replace' },
                            ]}
                            selected={[mode]}
                            onChange={([v]) => setMode(v)}
                        />
                    ) : null}

                    {text.trim() ? (
                        <Banner tone={overLimit ? 'critical' : parsed.values.length ? 'success' : 'warning'}>
                            <BlockStack gap="100">
                                <Text as="p">
                                    {`${parsed.values.length} ${noun}${parsed.values.length === 1 ? '' : 's'} will be added`}
                                    {parsed.duplicates > 0
                                        ? `, ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? '' : 's'} skipped`
                                        : ''}
                                    {parsed.invalid.length > 0 ? `, ${parsed.invalid.length} skipped as invalid` : ''}
                                    {`. List total: ${total}.`}
                                </Text>
                                {parsed.invalid.length > 0 ? (
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        {`Skipped: ${parsed.invalid.slice(0, 5).join(', ')}`}
                                        {parsed.invalid.length > 5 ? ` and ${parsed.invalid.length - 5} more` : ''}
                                    </Text>
                                ) : null}
                                {overLimit ? (
                                    <Text as="p" variant="bodySm">
                                        {`A single condition holds at most ${MAX_LIST_ITEMS} entries. Remove some, or split them across separate locks.`}
                                    </Text>
                                ) : null}
                            </BlockStack>
                        </Banner>
                    ) : null}
                </BlockStack>
            </Modal.Section>
        </Modal>
    );
}
