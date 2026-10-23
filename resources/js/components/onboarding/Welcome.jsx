import Icon from './icons';

const APP_ICON = 'https://cdn.shopify.com/s/files/1/0718/7723/0786/files/Lock.png?v=1778586829';

/**
 * The first screen a merchant meets. It says what the app does, plays the
 * shopper's side of it, and hands over: "Set up your first lock" into the
 * stepper, "Skip" for anyone who already knows. It asks for nothing.
 *
 * Every claim is something the app does: the content types out of the lock
 * builder, the twelve conditions, the six widget palettes.
 */
export default function Welcome({ storeName, onStart, onSkip, skipping }) {
    return (
        <main className="page full ob-welcome">
            <div className="split">
                <div className="split-row">
                    <section className="work">
                        <div className="work-head">
                            <span className="hero-ic" aria-hidden="true">
                                <img src={APP_ICON} alt="" width="46" height="46" />
                            </span>
                            <h1 className="hero-h">{storeName ? `Welcome, ${storeName}` : 'Welcome'}</h1>
                            <p className="sm sub mt8">Decide who sees what on your storefront.</p>
                        </div>

                        <div className="work-body">
                            <div className="work-opts">
                                <div className="cap">
                                    <span className="cap-ic"><Icon name="products" /></span>
                                    <span>
                                        <span className="cap-t">Lock what you choose</span>
                                        <span className="cap-d">From one product to the whole store &mdash; or checkout, on Plus.</span>
                                    </span>
                                </div>
                                <div className="cap">
                                    <span className="cap-ic"><Icon name="user" /></span>
                                    <span>
                                        <span className="cap-t">Say who gets in</span>
                                        <span className="cap-d">
                                            Twelve checks, from a passcode to a customer tag, joined by <em>all</em> or <em>any</em>.
                                        </span>
                                    </span>
                                </div>
                                <div className="cap">
                                    <span className="cap-ic"><Icon name="screen" /></span>
                                    <span>
                                        <span className="cap-t">Design what they see</span>
                                        <span className="cap-d">Six palettes and your own wording, previewed as you build it.</span>
                                    </span>
                                </div>

                                <div className="uses">
                                    <span className="uses-l">What people build with it</span>
                                    <div className="use">
                                        <span className="use-ic"><Icon name="tag" /></span>
                                        <span>
                                            <span className="use-t">Wholesale catalogue</span>
                                            <span className="use-x">trade prices for approved stockists</span>
                                        </span>
                                    </div>
                                    <div className="use">
                                        <span className="use-ic"><Icon name="key" /></span>
                                        <span>
                                            <span className="use-t">Members area</span>
                                            <span className="use-x">pages and posts for signed-in customers</span>
                                        </span>
                                    </div>
                                    <div className="use">
                                        <span className="use-ic"><Icon name="wrench" /></span>
                                        <span>
                                            <span className="use-t">Store in progress</span>
                                            <span className="use-x">one passcode while you rebuild</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* The shopper's view: one nine-second CSS loop. Under
                        prefers-reduced-motion it stops on the locked frame. */}
                    <aside className="stage w demo" aria-label="What shoppers see">
                        <span className="demo-glow" aria-hidden="true" />
                        <div className="device" aria-hidden="true">
                            <div className="sk">
                                <i style={{ width: '46%', height: 12 }} /><i className="gap" />
                                <i /><i style={{ width: '88%' }} /><i style={{ width: '70%' }} /><i className="gap" />
                                <i style={{ width: '40%', height: 11 }} /><i /><i style={{ width: '80%' }} />
                                <i className="gap" />
                                <i style={{ width: '34%', height: 11 }} /><i style={{ width: '92%' }} />
                                <i style={{ width: '66%' }} />
                            </div>
                            <div className="veil">
                                <div className="lk" style={{ background: '#fff', color: '#1a1a1a' }}>
                                    <div className="lk-ico"><Icon name="lock" size={15} strokeWidth={1.8} /></div>
                                    <div className="lk-t">Members only</div>
                                    <div className="lk-m">Enter your passcode to view this page.</div>
                                    <div className="lk-f">
                                        <span className="demo-ph">Passcode</span>
                                        <span className="demo-dots">&bull;&bull;&bull;&bull;</span>
                                    </div>
                                    <div className="lk-b" style={{ background: '#1a1a1a', color: '#fff' }}>Unlock</div>
                                </div>
                            </div>
                            <div className="demo-ok">
                                <span><Icon name="check" strokeWidth={2.6} /> Unlocked</span>
                            </div>
                        </div>
                        <span className="stage-cap">What shoppers see</span>
                    </aside>
                </div>

                <div className="work-foot">
                    <button type="button" className="foot-skip" onClick={onSkip} disabled={skipping}>
                        Skip
                    </button>
                    <button type="button" className="btn primary" onClick={onStart}>
                        Set up your first lock
                    </button>
                </div>
            </div>
        </main>
    );
}
