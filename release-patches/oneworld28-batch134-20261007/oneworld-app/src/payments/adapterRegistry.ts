import type { Provider } from './acceptance.ts';
import { disabledProviderAdapter, type ProviderAdapter } from './providerAdapter.ts';

/** Server-only adapter selection. Missing providers always resolve to a fail-closed adapter. */
export class ProviderAdapterRegistry {
  readonly #adapters = new Map<Provider, ProviderAdapter>();

  constructor(adapters: readonly ProviderAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: ProviderAdapter): void {
    if (this.#adapters.has(adapter.provider)) throw new Error(`Provider adapter already registered: ${adapter.provider}`);
    this.#adapters.set(adapter.provider, adapter);
  }

  resolve(provider: Provider): ProviderAdapter {
    return this.#adapters.get(provider) ?? disabledProviderAdapter(provider);
  }

  isRegistered(provider: Provider): boolean {
    return this.#adapters.has(provider);
  }
}

/** Current production registry: no live payment transport is enabled. */
export function createOnePayAdapterRegistry(): ProviderAdapterRegistry {
  return new ProviderAdapterRegistry([disabledProviderAdapter('wompi')]);
}
