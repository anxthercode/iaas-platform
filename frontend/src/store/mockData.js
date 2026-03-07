export const initialFirewallRules = [
  { id: 'fw1', direction: 'ingress', action: 'allow', protocol: 'tcp', port: '22', source: '0.0.0.0/0', comment: 'SSH' },
  { id: 'fw2', direction: 'ingress', action: 'allow', protocol: 'tcp', port: '80,443', source: '0.0.0.0/0', comment: 'HTTP/HTTPS' },
  { id: 'fw3', direction: 'egress', action: 'allow', protocol: 'all', port: 'any', source: '0.0.0.0/0', comment: 'All outbound' },
  { id: 'fw4', direction: 'ingress', action: 'deny', protocol: 'icmp', port: '\u2014', source: '0.0.0.0/0', comment: 'Block ping' },
];

export const initialSupportSessions = [
  { id: 'ss-001', engineer: '\u0421\u0435\u0440\u0433\u0435\u0439 \u041d\u0438\u043a\u043e\u043b\u0430\u0435\u0432', tenant: 'ACME Corporation', scope: 'read-only', status: 'active', started: '13:52:10', expires: '14:52:10', reason: '\u0412\u041c \u043d\u0435 \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u0442\u0441\u044f (\u0442\u0438\u043a\u0435\u0442 #4821)' },
  { id: 'ss-002', engineer: '\u0410\u043d\u043d\u0430 \u0411\u0435\u043b\u043e\u0432\u0430', tenant: 'Startup Inc.', scope: 'limited-write', status: 'expired', started: '12:58:17', expires: '13:58:17', reason: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 Firewall \u043f\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0443 \u043a\u043b\u0438\u0435\u043d\u0442\u0430' },
];
