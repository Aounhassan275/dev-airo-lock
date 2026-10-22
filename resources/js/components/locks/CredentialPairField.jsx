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
import { useEffect, useState } from 'react';
import { isValidEmail, MAX_LIST_ITEMS } from '../../lib/bulkList';
import { copyText, downloadTextFile } from '../../lib/downloadFile';
import {
    countDuplicateEmails,
    isCompletePair,
    joinPairs,
    pairsToCsv,
    pairTemplateCsv,
    parseBulkPairs,
    splitPairs,
} from '../../lib/pairList';

const BROWSE_THRESHOLD = 6;
const PAGE_SIZE = 20;

/**
 * Editor for the paired-credentials condition: one passcode per email address.
 *
 * Two inputs per row rather than the single input of PasscodeListField, but the
 * same affordances — bulk paste/upload, CSV export, a template, search and
 * paging — because this is the list merchants fill for hundreds of customers.
 */
export default function CredentialPairField({ value, onChange, helpText }) {
    // Rows derive from the prop on every render, so a discard that restores the
    // parent's state without remounting is reflected here immediately.
    const rows = splitPairs(value);

    const [query, setQuery] = useState('');
    const [page, setPage] = useState(0);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [exportNotice, setExportNotice] = useState('');

    // A legacy or hand-edited value re-serialises to the canonical
    // `email,passcode` form on first render, so the next save repairs it.
    useEffect(() => {
        const joined = joinPairs(rows);
        if (joined !== String(value ?? '')) onChange(joined);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const update = (next) => onChange(joinPairs(next));

    const complete = rows.filter(isCompletePair);
    const started = rows.filter((r) => r.email.trim() !== '' || r.passcode.trim() !== '');
    const incomplete = started.length - complete.length;
    const duplicates = countDuplicateEmails(rows);
    const browsing = rows.length > BROWSE_THRESHOLD;

    const needle = query.trim().toLowerCase();
    const matched = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => (needle ? `${row.email} ${row.passcode}`.toLowerCase().includes(needle) : true));
    const visible = browsing ? matched.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : matched;

    useEffect(() => {
        const lastPage = Math.max(0, Math.ceil(matched.length / PAGE_SIZE) - 1);
        if (page > lastPage) setPage(lastPage);
    }, [matched.length, page]);

    const setRow = (index, patch) => update(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

    const handleExport = async () => {
        if (downloadTextFile('paired-credentials.csv', pairsToCsv(complete))) {
            setExportNotice('');

            return;
        }
        const copied = await copyText(complete.map((p) => `${p.email},${p.passcode}`).join('\n'));
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
                    <Text as="p" variant="bodyMd">
                        Email and passcode pairs
                    </Text>
                    {complete.length > 1 ? <Badge tone="info">{`${complete.length} pairs`}</Badge> : null}
                </InlineStack>
                <InlineStack gap="200" blockAlign="center">
                    <Button icon={ImportIcon} onClick={() => setBulkOpen(true)}>
                        Add in bulk
                    </Button>
                    {complete.length > 0 ? (
                        <Button icon={ExportIcon} onClick={handleExport}>
                            Download CSV
                        </Button>
                    ) : null}
                    {rows.length > 1 ? (
                        <Button variant="plain" tone="critical" onClick={() => update([{ email: '', passcode: '' }])}>
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

            {duplicates > 0 || incomplete > 0 ? (
                <Banner tone="warning">
                    {duplicates > 0
                        ? `${duplicates} repeated email ${duplicates === 1 ? 'address' : 'addresses'} — only the first passcode for an address is used. `
                        : ''}
                    {incomplete > 0
                        ? `${incomplete} ${incomplete === 1 ? 'row is' : 'rows are'} missing an email or a passcode and will not be saved.`
                        : ''}
                </Banner>
            ) : null}

            {browsing ? (
                <TextField
                    label="Search pairs"
                    labelHidden
                    value={query}
                    onChange={(v) => {
                        setQuery(v);
                        setPage(0);
                    }}
                    autoComplete="off"
                    placeholder={`Search ${rows.length} pairs by email or passcode`}
                    clearButton
                    onClearButtonClick={() => {
                        setQuery('');
                        setPage(0);
                    }}
                />
            ) : null}

            {visible.length === 0 ? (
                <Text as="p" variant="bodySm" tone="subdued">
                    {`No pairs match "${query}".`}
                </Text>
            ) : null}

            {visible.map(({ row, index }) => (
                <InlineStack key={index} gap="200" blockAlign="end" wrap={false}>
                    <div style={{ flex: 2, minWidth: 0 }}>
                        <TextField
                            label={`Email ${index + 1}`}
                            value={row.email}
                            // The separators are how the pair is stored — they
                            // can never be part of either half.
                            onChange={(v) => setRow(index, { email: v.replace(/[\\\n,;\t:]/g, '') })}
                            autoComplete="off"
                            placeholder="customer@example.com"
                            error={
                                row.email.trim() !== '' && !isValidEmail(row.email)
                                    ? 'Not a valid email address'
                                    : undefined
                            }
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <TextField
                            label={`Passcode ${index + 1}`}
                            value={row.passcode}
                            onChange={(v) => setRow(index, { passcode: v.replace(/[\\\n,;\t:]/g, '') })}
                            autoComplete="off"
                            placeholder="VIP-0001"
                            connectedRight={
                                rows.length > 1 ? (
                                    <Button
                                        icon={DeleteIcon}
                                        accessibilityLabel={`Remove pair ${index + 1}`}
                                        onClick={() => update(rows.filter((_, j) => j !== index))}
                                    />
                                ) : undefined
                            }
                        />
                    </div>
                </InlineStack>
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
                <Button icon={PlusIcon} variant="plain" onClick={() => update([...rows, { email: '', passcode: '' }])}>
                    Add another pair
                </Button>
            </div>

            {helpText ? (
                <Text as="p" variant="bodySm" tone="subdued">
                    {helpText}
                </Text>
            ) : null}

            <BulkPairsModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                existing={rows}
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

function BulkPairsModal({ open, onClose, existing, onApply }) {
    const [text, setText] = useState('');
    const [mode, setMode] = useState('append');
    const [notice, setNotice] = useState(null);

    useEffect(() => {
        if (open) {
            setText('');
            setMode('append');
            setNotice(null);
        }
    }, [open]);

    const usable = existing.filter(isCompletePair);
    const keptExisting = mode === 'append' ? usable : [];
    const parsed = parseBulkPairs(text, { existing: keptExisting });

    const total = keptExisting.length + parsed.pairs.length;
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
        reader.onload = () => setText((current) => (current ? `${current}\n${reader.result}` : String(reader.result)));
        reader.readAsText(file);
    };

    const handleTemplate = () => {
        const csv = pairTemplateCsv();
        if (downloadTextFile('paired-credentials-template.csv', csv)) {
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
            title="Add email and passcode pairs in bulk"
            primaryAction={{
                content: parsed.pairs.length
                    ? `Add ${parsed.pairs.length} pair${parsed.pairs.length === 1 ? '' : 's'}`
                    : 'Add',
                disabled: parsed.pairs.length === 0 || overLimit,
                onAction: () => onApply([...keptExisting, ...parsed.pairs]),
            }}
            secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
        >
            <Modal.Section>
                <BlockStack gap="400">
                    <TextField
                        label="Paste pairs"
                        value={text}
                        onChange={setText}
                        multiline={8}
                        autoComplete="off"
                        placeholder="customer1@example.com, VIP-0001"
                        helpText="One pair per line: the email address, then the passcode issued to that person. Separate the two with a comma, semicolon, tab or colon."
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
                            A two-column .csv (email, passcode) — fill it in and upload it back.
                        </Text>
                    </InlineStack>

                    {notice ? (
                        <Banner tone={notice.tone} onDismiss={() => setNotice(null)}>
                            {notice.message}
                        </Banner>
                    ) : null}

                    {usable.length > 0 ? (
                        <ChoiceList
                            title={`${usable.length} pair${usable.length === 1 ? '' : 's'} already in this list`}
                            choices={[
                                { label: 'Keep them and add to the list', value: 'append' },
                                { label: 'Replace the list with what I paste', value: 'replace' },
                            ]}
                            selected={[mode]}
                            onChange={([v]) => setMode(v)}
                        />
                    ) : null}

                    {text.trim() ? (
                        <Banner tone={overLimit ? 'critical' : parsed.pairs.length ? 'success' : 'warning'}>
                            <BlockStack gap="100">
                                <Text as="p">
                                    {`${parsed.pairs.length} pair${parsed.pairs.length === 1 ? '' : 's'} will be added`}
                                    {parsed.duplicates > 0
                                        ? `, ${parsed.duplicates} repeated email${parsed.duplicates === 1 ? '' : 's'} skipped`
                                        : ''}
                                    {parsed.invalid.length > 0 ? `, ${parsed.invalid.length} skipped` : ''}
                                    {`. List total: ${total}.`}
                                </Text>
                                {parsed.invalid.length > 0 ? (
                                    <Text as="p" variant="bodySm" tone="subdued">
                                        {`Skipped (needs both an email and a passcode): ${parsed.invalid.slice(0, 5).join(' · ')}`}
                                        {parsed.invalid.length > 5 ? ` and ${parsed.invalid.length - 5} more` : ''}
                                    </Text>
                                ) : null}
                                {overLimit ? (
                                    <Text as="p" variant="bodySm">
                                        {`A single condition holds at most ${MAX_LIST_ITEMS} pairs. Split them across separate locks.`}
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
