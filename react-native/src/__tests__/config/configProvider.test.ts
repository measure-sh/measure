import { ConfigProvider } from '../../config/configProvider';
import { Config } from '../../config/config';
import { DynamicConfig } from '../../config/dynamicConfig';

describe('ConfigProvider.shouldDiscardLog', () => {
  let provider: ConfigProvider;

  beforeEach(() => {
    provider = new ConfigProvider(new Config());
  });

  const withIgnorePatterns = (patterns: string[]): DynamicConfig => {
    const config = DynamicConfig.default();
    config.logIgnorePatterns = patterns;
    return config;
  };

  it('returns false when no ignore patterns are configured', () => {
    expect(provider.shouldDiscardLog('some log body')).toBe(false);
  });

  it('returns true when the body matches a configured pattern', () => {
    provider.setDynamicConfig(withIgnorePatterns(['secret']));

    expect(provider.shouldDiscardLog('this contains a secret value')).toBe(true);
    expect(provider.shouldDiscardLog('nothing sensitive here')).toBe(false);
  });

  it('ignores invalid regex patterns', () => {
    provider.setDynamicConfig(withIgnorePatterns(['[invalid(', 'token']));

    expect(provider.shouldDiscardLog('has a token')).toBe(true);
    expect(provider.shouldDiscardLog('no match')).toBe(false);
  });
});
