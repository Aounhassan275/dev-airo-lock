const Ziggy = {
    url: 'http:\/\/localhost',
    port: null,
    defaults: {},
    routes: {
        webhook: { uri: 'webhook\/{type}', methods: ['POST'], parameters: ['type'] },
        home: { uri: '\/', methods: ['GET', 'HEAD'] },
        authenticate: { uri: 'authenticate', methods: ['GET', 'POST', 'HEAD'] },
        'authenticate.token': { uri: 'authenticate\/token', methods: ['GET', 'HEAD'] },
        billing: { uri: 'billing\/{plan?}', methods: ['GET', 'HEAD'], wheres: { plan: '^([0-9]+|)$' }, parameters: ['plan'] },
        'billing.process': { uri: 'billing\/process\/{plan?}', methods: ['GET', 'HEAD'], wheres: { plan: '^([0-9]+|)$' }, parameters: ['plan'] },
        'billing.usage_charge': { uri: 'billing\/usage-charge', methods: ['GET', 'POST', 'HEAD'] },
        'sanctum.csrf-cookie': { uri: 'sanctum\/csrf-cookie', methods: ['GET', 'HEAD'] },
        'storage.local': { uri: 'storage\/{path}', methods: ['GET', 'HEAD'], wheres: { path: '.*' }, parameters: ['path'] },
    },
};
if (typeof window !== 'undefined' && typeof window.Ziggy !== 'undefined') {
    Object.assign(Ziggy.routes, window.Ziggy.routes);
}
export { Ziggy };
