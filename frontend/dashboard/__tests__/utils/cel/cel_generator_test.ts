import { conditionsToCel } from "@/app/utils/cel/cel_generator";
import { ParsedConditions } from "@/app/utils/cel/cel_parser";

describe('CEL Generator', () => {
    describe('CEL from event conditions', () => {
        test('generates CEL for single event type condition', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'anr',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: []
                    }],
                    operators: []
                }
            };


            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "anr")');
        });

        test('generates CEL for event with standard attribute', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'exception',
                        attrs: [{
                            id: 'attr1',
                            key: 'handled',
                            type: 'boolean',
                            value: false,
                            operator: 'eq'
                        }],
                        ud_attrs: [],
                        session_attrs: []
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "exception" && exception.handled == false)');
        });

        test('generates CEL for event with user-defined attribute', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'custom',
                        attrs: [],
                        ud_attrs: [
                            {
                                id: 'ud_attr1',
                                key: 'user_tier',
                                type: 'string',
                                value: 'premium',
                                operator: 'eq'
                            }
                        ],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };


            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "custom" && event.user_defined_attrs.user_tier == "premium")');
        });

        test('generates CEL for event with both standard and user-defined attributes', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'exception',
                        attrs: [{
                            id: 'attr1',
                            key: 'handled',
                            type: 'boolean',
                            value: false,
                            operator: 'eq'
                        }],
                        ud_attrs: [{
                            id: 'ud_attr1',
                            key: 'user_tier',
                            type: 'string',
                            value: 'premium',
                            operator: 'eq'
                        }],
                        session_attrs: []
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "exception" && exception.handled == false && event.user_defined_attrs.user_tier == "premium")');
        });

        test('generates CEL for multiple event conditions with AND operator', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'exception',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [],

                    }, {
                        id: 'cond2',
                        type: 'anr',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: ['AND']
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('((event_type == "exception") && (event_type == "anr"))');
        });

        test('generates CEL for multiple event conditions with AND operator', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'exception',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [],
                    }, {
                        id: 'cond2',
                        type: 'anr',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: ['OR']
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('((event_type == "exception") || (event_type == "anr"))');
        });

        test('generates CEL with string contains operator', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'custom',
                        attrs: [{
                            id: 'attr1',
                            key: 'name',
                            type: 'string',
                            value: 'abc',
                            operator: 'contains'
                        }],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "custom" && custom.name.contains("abc"))');
        });

        test('generates CEL with string startsWith operator', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'custom',
                        attrs: [{
                            id: 'attr1',
                            key: 'name',
                            type: 'string',
                            value: 'prefix_',
                            operator: 'startsWith'
                        }],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "custom" && custom.name.startsWith("prefix_"))');
        });

        test('generates CEL with numeric comparison operators', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'custom',
                        attrs: [
                            { id: 'attr1', key: 'count', type: 'number', value: 5, operator: 'gt' },
                            { id: 'attr2', key: 'limit', type: 'number', value: 10, operator: 'lte' }
                        ],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "custom" && custom.count > 5 && custom.limit <= 10)');
        });
    });

    describe('CEL from session conditions', () => {
        test('generates CEL for single session attribute', () => {
            const conditions: ParsedConditions = {
                session: {
                    conditions: [{
                        id: 'cond1',
                        attrs: [{
                            id: 'attr1',
                            key: 'is_device_foldable',
                            type: 'boolean',
                            value: true,
                            operator: 'eq'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(attribute.is_device_foldable == true)');
        });

        test('generates CEL for multiple session attributes with AND operator', () => {
            const conditions: ParsedConditions = {
                session: {
                    conditions: [
                        {
                            id: 'cond1',
                            attrs: [{
                                id: 'attr1',
                                key: 'is_device_foldable',
                                type: 'boolean',
                                value: true,
                                operator: 'eq'
                            }]
                        },
                        {
                            id: 'cond2',
                            attrs: [{
                                id: 'attr2',
                                key: 'app_version',
                                type: 'string',
                                value: '1.0.0',
                                operator: 'eq'
                            }]
                        }
                    ],
                    operators: ['AND']
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('((attribute.is_device_foldable == true) && (attribute.app_version == "1.0.0"))');
        });

        test('generates CEL for session attribute with string operators', () => {
            const conditions: ParsedConditions = {
                session: {
                    conditions: [{
                        id: 'cond1',
                        attrs: [{
                            id: 'attr1',
                            key: 'device_model',
                            type: 'string',
                            value: 'Samsung',
                            operator: 'startsWith'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(attribute.device_model.startsWith("Samsung"))');
        });
    });

    describe('Trace Conditions', () => {
        test('generates CEL for single span name condition', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'Activity TTID',
                        operator: 'eq',
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name == "Activity TTID")');
        });

        test('generates CEL for span name with string contains operator', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'HTTP',
                        operator: 'contains',
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name.contains("HTTP"))');
        });

        test('generates CEL for span name with string startsWith operator', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'HTTP GET',
                        operator: 'startsWith',
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name.startsWith("HTTP GET"))');
        });

        test('generates CEL for span with user-defined attributes', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'Activity TTID',
                        operator: 'eq',
                        ud_attrs: [{
                            id: 'ud_attr1',
                            key: 'api_level',
                            type: 'number',
                            value: 21,
                            operator: 'gte'
                        }],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name == "Activity TTID" && trace.user_defined_attrs.api_level >= 21)');
        });

        test('generates CEL for span with multiple user-defined attributes', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'HTTP Request',
                        operator: 'eq',
                        ud_attrs: [
                            {
                                id: 'ud_attr1',
                                key: 'status_code',
                                type: 'number',
                                value: 200,
                                operator: 'eq'
                            },
                            {
                                id: 'ud_attr2',
                                key: 'method',
                                type: 'string',
                                value: 'GET',
                                operator: 'eq'
                            }
                        ],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name == "HTTP Request" && trace.user_defined_attrs.status_code == 200 && trace.user_defined_attrs.method == "GET")');
        });

        test('generates CEL for multiple trace conditions with AND operator', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [
                        {
                            id: 'cond1',
                            spanName: 'Activity TTID',
                            operator: 'eq',
                            ud_attrs: [],
                            session_attrs: [],
                        },
                        {
                            id: 'cond2',
                            spanName: 'HTTP GET',
                            operator: 'startsWith',
                            ud_attrs: [],
                            session_attrs: [],
                        }
                    ],
                    operators: ['AND']
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('((span_name == "Activity TTID") && (span_name.startsWith("HTTP GET")))');
        });

        test('generates CEL for multiple trace conditions with OR operator', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [
                        {
                            id: 'cond1',
                            spanName: 'Activity TTID',
                            operator: 'eq',
                            ud_attrs: [],
                            session_attrs: [],
                        },
                        {
                            id: 'cond2',
                            spanName: 'HTTP GET /config',
                            operator: 'startsWith',
                            ud_attrs: [],
                            session_attrs: [],
                        }
                    ],
                    operators: ['OR']
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('((span_name == "Activity TTID") || (span_name.startsWith("HTTP GET /config")))');
        });

        test('generates CEL for user-defined attributes with string operators', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'Database Query',
                        operator: 'eq',
                        ud_attrs: [
                            {
                                id: 'ud_attr1',
                                key: 'table_name',
                                type: 'string',
                                value: 'user',
                                operator: 'contains'
                            },
                            {
                                id: 'ud_attr2',
                                key: 'query_type',
                                type: 'string',
                                value: 'SELECT',
                                operator: 'startsWith'
                            }
                        ],
                        session_attrs: [],
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name == "Database Query" && trace.user_defined_attrs.table_name.contains("user") && trace.user_defined_attrs.query_type.startsWith("SELECT"))');
        });
    });

    describe('CEL from event conditions with session_attrs', () => {
        test('generates CEL for event with session_attrs', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'exception',
                        attrs: [{
                            id: 'attr1',
                            key: 'handled',
                            type: 'boolean',
                            value: false,
                            operator: 'eq'
                        }],
                        ud_attrs: [],
                        session_attrs: [{
                            id: 'session1',
                            key: 'is_device_foldable',
                            type: 'boolean',
                            value: true,
                            operator: 'eq'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "exception" && exception.handled == false && attribute.is_device_foldable == true)');
        });

        test('generates CEL for event with multiple session_attrs', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'anr',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [
                            {
                                id: 'session1',
                                key: 'app_version',
                                type: 'string',
                                value: '1.0.0',
                                operator: 'eq'
                            },
                            {
                                id: 'session2',
                                key: 'device_manufacturer',
                                type: 'string',
                                value: 'Samsung',
                                operator: 'startsWith'
                            }
                        ]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "anr" && attribute.app_version == "1.0.0" && attribute.device_manufacturer.startsWith("Samsung"))');
        });

        test('generates CEL for event with attrs, ud_attrs, and session_attrs', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'custom',
                        attrs: [{
                            id: 'attr1',
                            key: 'name',
                            type: 'string',
                            value: 'login',
                            operator: 'eq'
                        }],
                        ud_attrs: [{
                            id: 'ud1',
                            key: 'user_tier',
                            type: 'string',
                            value: 'premium',
                            operator: 'eq'
                        }],
                        session_attrs: [{
                            id: 'session1',
                            key: 'platform',
                            type: 'string',
                            value: 'android',
                            operator: 'eq'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "custom" && custom.name == "login" && event.user_defined_attrs.user_tier == "premium" && attribute.platform == "android")');
        });
    });

    describe('CEL from trace conditions with session_attrs', () => {
        test('generates CEL for trace with session_attrs', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'Activity TTID',
                        operator: 'eq',
                        ud_attrs: [],
                        session_attrs: [{
                            id: 'session1',
                            key: 'is_device_foldable',
                            type: 'boolean',
                            value: true,
                            operator: 'eq'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name == "Activity TTID" && attribute.is_device_foldable == true)');
        });

        test('generates CEL for trace with ud_attrs and session_attrs', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'HTTP Request',
                        operator: 'contains',
                        ud_attrs: [{
                            id: 'ud1',
                            key: 'api_level',
                            type: 'number',
                            value: 21,
                            operator: 'gte'
                        }],
                        session_attrs: [{
                            id: 'session1',
                            key: 'app_version',
                            type: 'string',
                            value: '2.0',
                            operator: 'startsWith'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name.contains("HTTP Request") && trace.user_defined_attrs.api_level >= 21 && attribute.app_version.startsWith("2.0"))');
        });

        test('generates CEL for trace with multiple session_attrs', () => {
            const conditions: ParsedConditions = {
                trace: {
                    conditions: [{
                        id: 'cond1',
                        spanName: 'Database Query',
                        operator: 'eq',
                        ud_attrs: [],
                        session_attrs: [
                            {
                                id: 'session1',
                                key: 'device_model',
                                type: 'string',
                                value: 'Pixel',
                                operator: 'contains'
                            },
                            {
                                id: 'session2',
                                key: 'os_version',
                                type: 'number',
                                value: 13,
                                operator: 'gte'
                            }
                        ]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(span_name == "Database Query" && attribute.device_model.contains("Pixel") && attribute.os_version >= 13)');
        });
    });

    describe('CEL from combined conditions', () => {
        test('generates CEL for event and session conditions', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'anr',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                },
                session: {
                    conditions: [{
                        id: 'cond2',
                        attrs: [{
                            id: 'attr1',
                            key: 'is_device_foldable',
                            type: 'boolean',
                            value: true,
                            operator: 'eq'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "anr") && (attribute.is_device_foldable == true)');
        });

        test('generates CEL for event, trace, and session conditions', () => {
            const conditions: ParsedConditions = {
                event: {
                    conditions: [{
                        id: 'cond1',
                        type: 'custom',
                        attrs: [],
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                },
                trace: {
                    conditions: [{
                        id: 'cond2',
                        spanName: 'Activity TTID',
                        operator: 'eq',
                        ud_attrs: [],
                        session_attrs: [],
                    }],
                    operators: []
                },
                session: {
                    conditions: [{
                        id: 'cond3',
                        attrs: [{
                            id: 'attr1',
                            key: 'platform',
                            type: 'string',
                            value: 'android',
                            operator: 'eq'
                        }]
                    }],
                    operators: []
                }
            };

            const result = conditionsToCel(conditions);
            expect(result).toBe('(event_type == "custom") && (span_name == "Activity TTID") && (attribute.platform == "android")');
        });
    });
});