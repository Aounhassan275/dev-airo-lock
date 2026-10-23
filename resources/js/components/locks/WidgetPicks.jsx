import CreateWidgetButton from './CreateWidgetButton';
import { widgetColors } from './LockPreview';

/**
 * A widget design is a set of colours, so the picker shows them: the card,
 * its text, and the button on it. One pill per saved design plus "Default
 * design", and a "+ Create widget" tile that opens the real widget editor
 * (the same one the Widgets page uses) without leaving the lock.
 */
export default function WidgetPicks({
    type,
    label,
    help,
    widgets = [],
    value,
    onChange,
    onCreated,
    storeLocales = [],
    primaryLocale = '',
}) {
    const current = value ? String(value) : '';
    const options = [{ id: '', name: 'Default design', widget: null }, ...widgets.map((w) => ({ id: String(w.id), name: w.name, widget: w }))];

    return (
        <div className="field">
            <span className="label">{label}</span>
            <div className="picks-row">
                <div className="picks" role="radiogroup" aria-label={label}>
                    {options.map((o) => {
                        const c = widgetColors(o.widget);
                        const on = o.id === current;

                        return (
                            <label key={o.id || 'default'} className={`pick${on ? ' on' : ''}`}>
                                <input
                                    type="radio"
                                    name={`lock-${type}-design`}
                                    value={o.id}
                                    checked={on}
                                    onChange={() => onChange(o.id)}
                                />
                                <span className="pick-sw" aria-hidden="true" style={{ background: c.card, color: c.text }}>
                                    <i style={{ background: type === 'text' ? c.text : c.buttonBg }} />
                                </span>
                                <span className="pick-n">{o.name}</span>
                            </label>
                        );
                    })}
                </div>
                <CreateWidgetButton
                    type={type}
                    widgets={widgets}
                    storeLocales={storeLocales}
                    primaryLocale={primaryLocale}
                    onCreated={onCreated}
                    renderTrigger={(open) => (
                        <button type="button" className="pick-add" onClick={open}>
                            <span className="pick-plus" aria-hidden="true">+</span>
                            <span className="pick-n">Create widget</span>
                        </button>
                    )}
                />
            </div>
            {help ? <span className="help">{help}</span> : null}
        </div>
    );
}
