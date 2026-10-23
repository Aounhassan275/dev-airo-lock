import { Modal } from '@shopify/polaris';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BinIcon, ChevronRightIcon } from './LockIcons';
import {
    CONDITION_TYPES,
    ConditionFields,
    FORM_BASED_CONDITIONS,
    conditionLabel,
    conditionValueSummary,
} from './conditionTypes';
import { PlanBadge, usePlanGate } from './planGate';

/**
 * AND / OR. It governs every condition under it, so it is a segmented control
 * with both words visible rather than a select that shows one.
 */
export function OperatorSeg({ operator, onChange, name = 'lock-operator' }) {
    return (
        <div className="seg" role="radiogroup" aria-label="How the conditions combine">
            {[
                ['AND', 'all must match'],
                ['OR', 'any can match'],
            ].map(([value, hint]) => (
                <label key={value} className={`seg-b${operator === value ? ' on' : ''}`}>
                    <input
                        type="radio"
                        name={name}
                        value={value}
                        checked={operator === value}
                        onChange={() => onChange(value)}
                    />
                    <span className="seg-t">{value}</span>
                    <span className="seg-d">{hint}</span>
                </label>
            ))}
        </div>
    );
}

/**
 * The conditions of one group as rows — number, the check, what it is set to,
 * Form/Text, remove — with the condition's own form in a modal. Every change
 * goes through the same group callbacks the builder's card-per-condition list
 * used, so the saved rules are unchanged.
 */
export default function ConditionList({ group, onChange, onAddCondition, checkoutMode = false }) {
    const { conditionTier } = usePlanGate();
    const conditions = useMemo(() => group.conditions || [], [group.conditions]);

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

    // Which condition the modal is editing, whether it was just added (so
    // Cancel takes it away again), and what it was before (so Cancel restores).
    const [editing, setEditing] = useState(null);
    const pendingAdd = useRef(null);

    const openAt = (idx) => setEditing({ idx, isNew: false, snapshot: conditions[idx] });

    const add = () => {
        pendingAdd.current = conditions.length;
        onAddCondition();
    };

    // The new, empty condition lands on the next render; open it then.
    useEffect(() => {
        if (pendingAdd.current !== null && conditions.length > pendingAdd.current) {
            const idx = pendingAdd.current;
            pendingAdd.current = null;
            setEditing({ idx, isNew: true, snapshot: conditions[idx] });
        }
    }, [conditions]);

    const cancel = () => {
        if (!editing) return;
        if (editing.isNew) removeCondition(editing.idx);
        else if (editing.snapshot) updateCondition(editing.idx, editing.snapshot);
        setEditing(null);
    };

    const current = editing ? conditions[editing.idx] : null;
    const currentIsForm = current?.type && FORM_BASED_CONDITIONS.has(current.type);
    const usedTypes = editing
        ? conditions.filter((_, i) => i !== editing.idx).map((c) => c.type).filter(Boolean)
        : [];
    const addDisabled = conditions.filter((c) => c.type).length >= CONDITION_TYPES.length;

    return (
        <>
            <p className="help lb-ophelp">
                Customer must meet {group.operator === 'AND' ? 'all' : 'any'} of the conditions below to unlock access.
            </p>

            <div className="lb-conds">
                {conditions.map((c, idx) => {
                    const summary = conditionValueSummary(c);
                    const isForm = c.type && FORM_BASED_CONDITIONS.has(c.type);

                    return (
                        <div
                            key={idx}
                            className="crow"
                            role="button"
                            tabIndex={0}
                            onClick={() => openAt(idx)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openAt(idx);
                                }
                            }}
                        >
                            <span className="crow-n">{idx + 1}</span>
                            <span className="crow-b">
                                <span className="crow-t">{conditionLabel(c.type)}</span>
                                <span className={`crow-v${summary ? '' : ' none'}`}>
                                    {summary || 'Not set yet — click to fill it in'}
                                </span>
                            </span>
                            <PlanBadge tier={conditionTier(c.type)} />
                            {c.type ? <span className={`tag ${isForm ? 'form' : 'text'}`}>{isForm ? 'Form' : 'Text'}</span> : null}
                            <button
                                type="button"
                                className="btn plain icon crow-x"
                                aria-label="Remove condition"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeCondition(idx);
                                }}
                            >
                                <BinIcon />
                            </button>
                            <span className="crow-go" aria-hidden="true">
                                <ChevronRightIcon />
                            </span>
                        </div>
                    );
                })}
            </div>

            <button type="button" className="addtile" onClick={add} disabled={addDisabled}>
                <span className="addtile-p" aria-hidden="true">+</span> Add condition
            </button>
            <p className="help mt8">
                {conditions.length} condition{conditions.length !== 1 ? 's' : ''}
            </p>

            <Modal
                open={!!current}
                onClose={cancel}
                title={editing?.isNew ? 'Add a condition' : `Condition ${(editing?.idx ?? 0) + 1}`}
                primaryAction={{
                    content: editing?.isNew ? 'Add condition' : 'Save condition',
                    onAction: () => setEditing(null),
                    disabled: !current?.type,
                }}
                secondaryActions={[{ content: 'Cancel', onAction: cancel }]}
                footer={<span className="pg-lock-builder lb-foot">Every condition is checked when a shopper arrives.</span>}
            >
                <Modal.Section>
                    {current ? (
                        <div className="airo pg-lock-builder lb-modal">
                            <div className="row g8" style={{ marginBottom: 12 }}>
                                <span className="tag">Permit if</span>
                                {current.type ? (
                                    <span className={`tag ${currentIsForm ? 'form' : 'text'}`}>{currentIsForm ? 'Form' : 'Text'}</span>
                                ) : null}
                                <PlanBadge tier={conditionTier(current.type)} />
                            </div>
                            <ConditionFields
                                condition={current}
                                onChange={(updated) => updateCondition(editing.idx, updated)}
                                usedTypes={usedTypes}
                                checkoutMode={checkoutMode}
                            />
                        </div>
                    ) : null}
                </Modal.Section>
            </Modal>
        </>
    );
}
