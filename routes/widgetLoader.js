const crypto = require('crypto');

router.get('/widget/:tenantId', async (req, res) => {
    const { tenantId } = req.params;
    
    const tenant = await db.tenants.findById(tenantId);
    if (!tenant || !tenant.widget_enabled) {
        return res.status(404).send('Widget not available');
    }
    
    // Generate short-lived signed token
    const widgetToken = jwt.sign(
        { 
            tenant_id: tenantId,
            type: 'widget_anonymous', // Limited permissions
            session_id: crypto.randomUUID(),
            exp: Math.floor(Date.now() / 1000) + (4 * 60 * 60) // 4 hours
        },
        process.env.WIDGET_SECRET
    );
    
    // Render widget with embedded token
    res.render('widget-embed', {
        token: widgetToken,
        tenantId,
        config: tenant.widget_config // Custom colors, greeting, etc.
    });
});