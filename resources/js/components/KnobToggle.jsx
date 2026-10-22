export default function KnobToggle({
    checked,
    onChange,
    disabled = false,
    activeLabel = 'Active',
    inactiveLabel = 'Inactive',
    showLabel = true,
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
            }}
        >
            <span
                style={{
                    position: 'relative',
                    width: '40px',
                    height: '22px',
                    borderRadius: '11px',
                    background: checked ? '#22c55e' : '#d1d5db',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                    boxShadow: checked ? '0 0 0 2px rgba(34,197,94,0.2)' : 'none',
                }}
            >
                <span
                    style={{
                        position: 'absolute',
                        top: '3px',
                        left: checked ? '21px' : '3px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                />
            </span>
            {showLabel && (
                <span
                    style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: checked ? '#16a34a' : '#6b7280',
                        minWidth: '52px',
                    }}
                >
                    {checked ? activeLabel : inactiveLabel}
                </span>
            )}
        </button>
    );
}
